"""
Tradejini (CubePlus) instrument and order helpers.

Instrument master is stored in Supabase (instrument_master table) and refreshed
once daily at 08:45 AM IST.  During trading hours every ATM lookup queries
Supabase directly — no in-memory DataFrame, no per-trade downloads.
"""

import csv
import datetime
import io
import logging
import threading
import time
from urllib.parse import quote

import pandas as pd
import requests
import pytz

# ── Instrument refresh state ──────────────────────────────────────────────────
# Tracks daily refresh without caching the full DataFrame in RAM.
_INSTRUMENT_STATE = {
    "last_refresh_date": None,   # datetime.date of last successful refresh
    "refresh_lock":      threading.Lock(),
    "is_refreshing":     False,
}

MIN_NIFTY_RECORDS      = 50    # minimum valid NIFTY contracts expected
MIN_BANKNIFTY_RECORDS  = 50    # minimum valid BANKNIFTY contracts expected
INSERT_BATCH_SIZE      = 500   # rows per Supabase batch insert
IST                    = pytz.timezone("Asia/Kolkata")

# ── In-memory instrument map for O(1) ATM lookup ──────────────────────────────
# Key format: "{INDEX}_{STRIKE}_{OPTION_TYPE}"  e.g. "NIFTY_23200_PE"
# Value: {"token": str, "symbol": str, "expiry": str}
instrument_map: dict[str, dict] = {}
instrument_map_lock = threading.Lock()

# Metadata for logging / admin
INSTRUMENT_MAP_META = {
    "nearest_expiry":   None,   # str like "2026-06-12"
    "built_at":         None,   # datetime.datetime
    "contract_count":   0,
    "nifty_spot":       None,   # float — spot price used for strike range filter
    "banknifty_spot":   None,
}

# ─────────────────────────────────────────────────────────────
# Private: find any active broker session
# ─────────────────────────────────────────────────────────────

# Caching for active user sessions to avoid repeated Supabase calls
_ACTIVE_USER_CACHE = {
    "user_id": None,
    "cached_at": 0.0
}
_active_user_lock = threading.Lock()


def _get_any_active_user_id() -> str | None:
    """Return any user_id that currently has an active broker session, prioritized by freshest first (cached for 15s)."""
    now = time.time()
    with _active_user_lock:
        if _ACTIVE_USER_CACHE["user_id"] is not None and (now - _ACTIVE_USER_CACHE["cached_at"]) < 15.0:
            return _ACTIVE_USER_CACHE["user_id"]

    try:
        from supabase_client import supabase
        res = (
            supabase.table("broker_sessions")
            .select("user_id")
            .eq("is_active", True)
            .order("token_created_at", desc=True)
            .limit(1)
            .execute()
        )
        if res.data:
            uid = res.data[0]["user_id"]
            with _active_user_lock:
                _ACTIVE_USER_CACHE["user_id"] = uid
                _ACTIVE_USER_CACHE["cached_at"] = now
            return uid
    except Exception as exc:
        logging.error(f"[INSTRUMENT] Could not find active broker session: {exc}")

    with _active_user_lock:
        return _ACTIVE_USER_CACHE["user_id"]


# ─────────────────────────────────────────────────────────────
# Public: refresh_instrument_master
# ─────────────────────────────────────────────────────────────

def refresh_instrument_master(force: bool = False) -> bool:
    """
    Download NIFTY + BANKNIFTY option contracts from Tradejini and store
    them in the Supabase instrument_master table.

    Rules:
      - Runs at most once per calendar day (IST) unless force=True.
      - Thread-safe via a lock — concurrent calls are dropped, not stacked.
      - NEVER called during trade execution.

    Returns True on success, False on any failure.
    """
    today = datetime.datetime.now(IST).date()

    with _INSTRUMENT_STATE["refresh_lock"]:
        if not force and _INSTRUMENT_STATE["last_refresh_date"] == today:
            logging.info("[INSTRUMENT] Refresh already completed today — skipping.")
            return True
        if _INSTRUMENT_STATE["is_refreshing"]:
            logging.warning("[INSTRUMENT] Refresh already in progress — skipping duplicate call.")
            return False
        _INSTRUMENT_STATE["is_refreshing"] = True

    try:
        logging.info("[INFO] Refreshing instrument master")

        # 1. Get a broker session
        user_id = _get_any_active_user_id()
        if not user_id:
            logging.error("[ERROR] Instrument list empty — no active broker session found")
            return False

        # 2. Download raw NFO instrument list
        df = download_nfo_instruments(user_id)
        if df is None or df.empty:
            logging.error("[ERROR] Instrument list empty — broker API returned no data")
            return False

        logging.info(f"[INSTRUMENT] Downloaded {len(df)} raw instruments from broker API")

        # 3. Filter NIFTY + BANKNIFTY option contracts only
        records = _build_instrument_records(df, today)
        if not records:
            logging.error("[ERROR] Instrument list empty — no NIFTY/BANKNIFTY contracts after filtering")
            return False

        nifty_count     = sum(1 for r in records if r["symbol"] == "NIFTY")
        banknifty_count = sum(1 for r in records if r["symbol"] == "BANKNIFTY")
        logging.info(
            f"[INFO] Downloaded NIFTY and BANKNIFTY contracts | "
            f"NIFTY={nifty_count} BANKNIFTY={banknifty_count} Total={len(records)}"
        )

        # 4. Validate minimum counts before touching Supabase
        if nifty_count < MIN_NIFTY_RECORDS:
            logging.error(
                f"[ERROR] NIFTY contracts missing — only {nifty_count} found "
                f"(minimum required: {MIN_NIFTY_RECORDS})"
            )
            return False
        if banknifty_count < MIN_BANKNIFTY_RECORDS:
            logging.error(
                f"[ERROR] BANKNIFTY contracts missing — only {banknifty_count} found "
                f"(minimum required: {MIN_BANKNIFTY_RECORDS})"
            )
            return False

        # 5. Delete all previous records (clean slate)
        from supabase_client import supabase
        for attempt in range(1, 4):
            try:
                supabase.table("instrument_master").delete().neq("sym_id", "").execute()
                logging.info("[INSTRUMENT] Cleared previous instrument_master records")
                break
            except Exception as exc:
                logging.error(f"[INSTRUMENT] Delete attempt {attempt} failed: {exc}")
                if attempt == 3:
                    return False
                time.sleep(2)

        # 6. Batch insert
        inserted = _batch_insert_instruments(supabase, records)
        if inserted == 0:
            logging.error("[INSTRUMENT] Batch insert produced 0 rows — aborting")
            return False

        logging.info(f"[INFO] Inserted {inserted} records into Supabase")

        # 7. Rebuild in-memory map from live Tradejini API (not from Supabase)
        build_instrument_map(force=True)

        # 8. Mark as done for today
        with _INSTRUMENT_STATE["refresh_lock"]:
            _INSTRUMENT_STATE["last_refresh_date"] = today

        return True

    except Exception as exc:
        logging.error(f"[INSTRUMENT] refresh_instrument_master unexpected error: {exc}", exc_info=True)
        return False
    finally:
        with _INSTRUMENT_STATE["refresh_lock"]:
            _INSTRUMENT_STATE["is_refreshing"] = False


def clean_val(val) -> str:
    if pd.isna(val):
        return ""
    val_str = str(val).strip()
    if val_str.lower() in ("nan", "null", "none"):
        return ""
    return val_str


def _build_instrument_records(df: pd.DataFrame, today: datetime.date) -> list[dict]:
    """
    Convert raw broker DataFrame rows into instrument_master Supabase records,
    keeping only NIFTY and BANKNIFTY CE/PE contracts with a future expiry.
    """
    records = []
    today_str = today.isoformat()

    for _, row in df.iterrows():
        sym_id_val  = clean_val(row.get("symId"))
        opt_type    = clean_val(row.get("optType")).upper()
        search_text = clean_val(row.get("searchText")).upper()
        trad_sym    = clean_val(row.get("tradSymbol")) or clean_val(row.get("dispSymbol")) or clean_val(row.get("dispName"))
        expiry_raw  = row.get("expiry")
        strike_raw  = row.get("strike")
        lot_raw     = row.get("lot")

        if not sym_id_val or not trad_sym:
            continue
        if opt_type not in ("CE", "PE"):
            continue

        # Classify underlying
        if "BANKNIFTY" in search_text:
            symbol = "BANKNIFTY"
        elif "NIFTY" in search_text and not any(
            x in search_text for x in ("FINNIFTY", "MIDCPNIFTY", "BANKFINIFTY")
        ):
            symbol = "NIFTY"
        else:
            continue  # not interested in FINNIFTY, MIDCPNIFTY, etc.

        # Parse expiry — skip expired contracts
        try:
            expiry_dt = pd.to_datetime(expiry_raw, errors="coerce")
            if pd.isna(expiry_dt) or expiry_dt.date() < today:
                continue
            expiry_str = expiry_dt.strftime("%Y-%m-%d")
        except Exception:
            continue

        # Parse strike — handle broker format where strike is stored ×100
        try:
            strike_num = float(str(strike_raw).replace(",", ""))
            if abs(strike_num) >= 100_000:
                strike_num = round(strike_num / 100.0, 2)
        except (ValueError, TypeError):
            continue

        # Parse lot size
        try:
            lot_size = int(float(str(lot_raw))) if lot_raw and clean_val(lot_raw) != "" else 0
        except (ValueError, TypeError):
            lot_size = 0

        records.append({
            "sym_id":       sym_id_val,
            "trad_symbol":  trad_sym,
            "symbol":       symbol,
            "strike":       strike_num,
            "expiry":       expiry_str,
            "option_type":  opt_type,
            "lot_size":     lot_size,
            "updated_date": today_str,
        })

    return records



def _batch_insert_instruments(supabase, records: list[dict], retries: int = 3) -> int:
    """Insert records in chunks of INSERT_BATCH_SIZE with exponential back-off on failure."""
    total_inserted = 0
    for chunk_start in range(0, len(records), INSERT_BATCH_SIZE):
        chunk = records[chunk_start: chunk_start + INSERT_BATCH_SIZE]
        chunk_num = chunk_start // INSERT_BATCH_SIZE + 1
        for attempt in range(1, retries + 1):
            try:
                supabase.table("instrument_master").insert(chunk).execute()
                total_inserted += len(chunk)
                break
            except Exception as exc:
                logging.error(
                    f"[INSTRUMENT] Batch insert chunk {chunk_num} attempt {attempt} failed: {exc}"
                )
                if attempt < retries:
                    time.sleep(2 ** attempt)
                else:
                    logging.error(
                        f"[INSTRUMENT] Batch insert chunk {chunk_num} permanently failed — "
                        f"{len(chunk)} records lost"
                    )
    return total_inserted


# ─────────────────────────────────────────────────────────────
# In-memory instrument map builder — downloads from Tradejini
# ─────────────────────────────────────────────────────────────

def _get_spot_yfinance(ticker_symbol: str) -> float | None:
    """Fetch current index spot via yfinance. Used at startup/build time only."""
    try:
        import yfinance as yf
        df = yf.download(ticker_symbol, period="1d", interval="1m", progress=False)
        if not df.empty:
            if isinstance(df.columns, pd.MultiIndex):
                df.columns = df.columns.get_level_values(0)
            return float(df['Close'].iloc[-1])
    except Exception as exc:
        logging.warning(f"[SPOT] yfinance fetch failed for {ticker_symbol}: {exc}")
    return None


def build_instrument_map(force: bool = False) -> bool:
    """
    Download NFO instruments from Tradejini API, filter to NIFTY/BANKNIFTY
    nearest-expiry CE/PE options within ±1500 of current spot, and populate
    instrument_map for O(1) ATM lookup.

    Rules:
      - Runs at most once per startup unless force=True.
      - Queries the broker API directly — NOT Supabase.
      - NEVER called during trade execution.
      - Thread-safe via instrument_map_lock.

    Returns True on success, False on any failure.
    """
    with instrument_map_lock:
        if not force and instrument_map:
            logging.info("[INSTRUMENT MAP] Already built — skipping")
            return True

    # 1. Get any active broker session
    user_id = _get_any_active_user_id()
    if not user_id:
        logging.error("[INSTRUMENT MAP] No active broker session — cannot download instruments")
        return False

    # 2. Download raw NFO instruments from Tradejini
    logging.info("[INSTRUMENT MAP] Downloading NFO instruments from Tradejini...")
    df = download_nfo_instruments(user_id)
    if df is None or df.empty:
        logging.error("[INSTRUMENT MAP] Download returned no data")
        return False

    # 3. Get current spot prices for strike range filter
    nifty_spot = _get_spot_yfinance("^NSEI")
    banknifty_spot = _get_spot_yfinance("^NSEBANK")
    if nifty_spot is None:
        nifty_spot = 23000.0
        logging.warning(f"[INSTRUMENT MAP] NIFTY spot unavailable — using default {nifty_spot}")
    if banknifty_spot is None:
        banknifty_spot = 48000.0
        logging.warning(f"[INSTRUMENT MAP] BANKNIFTY spot unavailable — using default {banknifty_spot}")

    today = datetime.datetime.now(IST).date()

    # 4. Parse & filter raw data
    records_raw = []
    for _, row in df.iterrows():
        try:
            sym_id_val = clean_val(row.get("symId"))
            opt_type   = clean_val(row.get("optType")).upper()
            search_txt = clean_val(row.get("searchText")).upper()
            trad_sym   = (clean_val(row.get("tradSymbol"))
                          or clean_val(row.get("dispSymbol"))
                          or clean_val(row.get("dispName")))
            expiry_raw = row.get("expiry")
            strike_raw = row.get("strike")

            if not sym_id_val or not trad_sym:
                continue
            if opt_type not in ("CE", "PE"):
                continue

            if "BANKNIFTY" in search_txt:
                symbol = "BANKNIFTY"
            elif "NIFTY" in search_txt and not any(
                x in search_txt for x in ("FINNIFTY", "MIDCPNIFTY", "BANKFINIFTY")
            ):
                symbol = "NIFTY"
            else:
                continue

            expiry_dt = pd.to_datetime(expiry_raw, errors="coerce")
            if pd.isna(expiry_dt) or expiry_dt.date() < today:
                continue
            expiry_str = expiry_dt.strftime("%Y-%m-%d")

            strike_num = float(str(strike_raw).replace(",", ""))
            if abs(strike_num) >= 100_000:
                strike_num = round(strike_num / 100.0, 2)

            records_raw.append({
                "sym_id":      sym_id_val,
                "trad_symbol": trad_sym,
                "symbol":      symbol,
                "strike":      strike_num,
                "expiry":      expiry_str,
                "option_type": opt_type,
            })
        except (ValueError, TypeError, AttributeError):
            continue

    if not records_raw:
        logging.error("[INSTRUMENT MAP] No valid NIFTY/BANKNIFTY contracts after parsing")
        return False

    # 5. Find nearest expiry
    expiries = sorted(set(r["expiry"] for r in records_raw))
    nearest_expiry = expiries[0]

    # 6. Filter to nearest expiry + strike range ±1500
    expiry_records = [r for r in records_raw if r["expiry"] == nearest_expiry]

    new_map: dict[str, dict] = {}
    count = 0
    for r in expiry_records:
        spot = nifty_spot if r["symbol"] == "NIFTY" else banknifty_spot
        if abs(r["strike"] - spot) > 1500:
            continue
        key = f"{r['symbol']}_{int(r['strike'])}_{r['option_type']}"
        new_map[key] = {
            "token":  r["sym_id"],
            "symbol": r["trad_symbol"],
            "expiry": r["expiry"],
        }
        count += 1

    # 7. Atomic swap
    with instrument_map_lock:
        instrument_map.clear()
        instrument_map.update(new_map)
        INSTRUMENT_MAP_META["nearest_expiry"]  = nearest_expiry
        INSTRUMENT_MAP_META["built_at"]        = datetime.datetime.now(IST)
        INSTRUMENT_MAP_META["contract_count"]  = count
        INSTRUMENT_MAP_META["nifty_spot"]      = nifty_spot
        INSTRUMENT_MAP_META["banknifty_spot"]  = banknifty_spot

    logging.info(f"[INSTRUMENT CACHE] Loaded {count} contracts")
    logging.info(f"[INSTRUMENT CACHE] Nearest expiry: {nearest_expiry}")
    logging.info(f"[INSTRUMENT CACHE] NIFTY spot: {nifty_spot:.2f} | BANKNIFTY spot: {banknifty_spot:.2f}")

    # 8. Also store in Supabase for admin dashboard (non-critical)
    try:
        from supabase_client import supabase, supabase_retry
        supabase_records = _build_instrument_records_for_db(df, today)
        if supabase_records:
            # Clear previous day's data
            try:
                supabase_retry(
                    lambda: supabase.table("instrument_master").delete().neq("sym_id", "").execute()
                )
            except Exception:
                pass
            _batch_insert_instruments(supabase, supabase_records)
            logging.info(f"[INSTRUMENT MAP] Synced {len(supabase_records)} records to Supabase for admin")
    except Exception as exc:
        logging.warning(f"[INSTRUMENT MAP] Supabase sync skipped: {exc}")

    return True


def _build_instrument_records_for_db(df: pd.DataFrame, today: datetime.date) -> list[dict]:
    """Build Supabase-ready records from raw broker DataFrame (subset of _build_instrument_records)."""
    records = []
    today_str = today.isoformat()
    for _, row in df.iterrows():
        sym_id_val  = clean_val(row.get("symId"))
        opt_type    = clean_val(row.get("optType")).upper()
        search_text = clean_val(row.get("searchText")).upper()
        trad_sym    = (clean_val(row.get("tradSymbol"))
                       or clean_val(row.get("dispSymbol"))
                       or clean_val(row.get("dispName")))
        expiry_raw  = row.get("expiry")
        strike_raw  = row.get("strike")
        lot_raw     = row.get("lot")

        if not sym_id_val or not trad_sym:
            continue
        if opt_type not in ("CE", "PE"):
            continue

        if "BANKNIFTY" in search_text:
            symbol = "BANKNIFTY"
        elif "NIFTY" in search_text and not any(
            x in search_text for x in ("FINNIFTY", "MIDCPNIFTY", "BANKFINIFTY")
        ):
            symbol = "NIFTY"
        else:
            continue

        try:
            expiry_dt = pd.to_datetime(expiry_raw, errors="coerce")
            if pd.isna(expiry_dt) or expiry_dt.date() < today:
                continue
            expiry_str = expiry_dt.strftime("%Y-%m-%d")
        except Exception:
            continue

        try:
            strike_num = float(str(strike_raw).replace(",", ""))
            if abs(strike_num) >= 100_000:
                strike_num = round(strike_num / 100.0, 2)
        except (ValueError, TypeError):
            continue

        try:
            lot_size = int(float(str(lot_raw))) if lot_raw and clean_val(lot_raw) != "" else 0
        except (ValueError, TypeError):
            lot_size = 0

        records.append({
            "sym_id":       sym_id_val,
            "trad_symbol":  trad_sym,
            "symbol":       symbol,
            "strike":       strike_num,
            "expiry":       expiry_str,
            "option_type":  opt_type,
            "lot_size":     lot_size,
            "updated_date": today_str,
        })
    return records


# ── Backward-compatible alias ─────────────────────────────────
def load_instrument_cache():
    """Legacy entry point — delegates to build_instrument_map."""
    build_instrument_map(force=False)


# ─────────────────────────────────────────────────────────────
# Public: validate_instrument_master
# ─────────────────────────────────────────────────────────────

def validate_instrument_master() -> dict:
    """
    Verify that today's instrument data exists and meets minimum thresholds.

    Returns a dict:
        { "valid": bool, "total": int, "nifty": int,
          "banknifty": int, "reason": str | None }
    """
    today  = datetime.datetime.now(IST).date().isoformat()
    result = {"valid": False, "total": 0, "nifty": 0, "banknifty": 0, "reason": None}

    try:
        from supabase_client import supabase

        # Total records for today
        total_res = (
            supabase.table("instrument_master")
            .select("sym_id", count="exact")
            .eq("updated_date", today)
            .execute()
        )
        total = total_res.count or 0
        result["total"] = total

        if total == 0:
            result["reason"] = "No instrument records found for today"
            logging.error("[ERROR] Instrument list empty — no records found for today in Supabase")
            return result

        # NIFTY count
        nifty_res = (
            supabase.table("instrument_master")
            .select("sym_id", count="exact")
            .eq("updated_date", today)
            .eq("symbol", "NIFTY")
            .execute()
        )
        nifty_count = nifty_res.count or 0
        result["nifty"] = nifty_count

        # BANKNIFTY count
        bnf_res = (
            supabase.table("instrument_master")
            .select("sym_id", count="exact")
            .eq("updated_date", today)
            .eq("symbol", "BANKNIFTY")
            .execute()
        )
        banknifty_count = bnf_res.count or 0
        result["banknifty"] = banknifty_count

        if nifty_count < MIN_NIFTY_RECORDS:
            result["reason"] = f"NIFTY contracts missing — only {nifty_count} records (min {MIN_NIFTY_RECORDS})"
            logging.error(f"[ERROR] NIFTY contracts missing — {nifty_count} records found")
            return result

        if banknifty_count < MIN_BANKNIFTY_RECORDS:
            result["reason"] = f"BANKNIFTY contracts missing — only {banknifty_count} records (min {MIN_BANKNIFTY_RECORDS})"
            logging.error(f"[ERROR] BANKNIFTY contracts missing — {banknifty_count} records found")
            return result

        result["valid"] = True
        logging.info(
            f"[INFO] Instrument validation successful | "
            f"total={total} NIFTY={nifty_count} BANKNIFTY={banknifty_count}"
        )
        # Update in-memory state so scheduler knows a refresh happened
        with _INSTRUMENT_STATE["refresh_lock"]:
            _INSTRUMENT_STATE["last_refresh_date"] = datetime.datetime.now(IST).date()

    except Exception as exc:
        logging.error(f"[INSTRUMENT] validate_instrument_master error: {exc}")
        result["reason"] = str(exc)

    return result


# ─────────────────────────────────────────────────────────────
# Public: select_atm_option  (O(1) map lookup — no DB)
# ─────────────────────────────────────────────────────────────

def _find_closest_strike(key_prefix: str, atm_strike: int, step: int, opt_type: str) -> str | None:
    """Search ±5 steps from the desired strike for the closest match in instrument_map."""
    with instrument_map_lock:
        for offset in range(0, 6):
            for sign in (1, -1) if offset > 0 else (1,):
                test_strike = atm_strike + (sign * offset * step)
                key = f"{key_prefix}_{test_strike}_{opt_type}"
                if key in instrument_map:
                    return key
    return None


def select_atm_option(
    user_id: str,
    index_ltp: float,
    index_name: str = "NIFTY",
    option_type: str = "PE",
) -> tuple:
    """
    Find ATM option via O(1) instrument_map lookup — zero database queries.

    Returns (sym_id, trad_symbol, ltp) or (None, None, None).
    """
    step        = 50 if index_name.upper() == "NIFTY" else 100
    atm_strike  = round(index_ltp / step) * step
    opt_type    = option_type.upper().strip()
    index_upper = index_name.upper()
    cache_key   = f"{index_upper}_{int(atm_strike)}_{opt_type}"

    logging.info(
        f"[ATM LOOKUP] {cache_key}  (spot={index_ltp:.2f})"
    )

    # ── O(1) map lookup — RAM only, zero network ──────────────
    with instrument_map_lock:
        entry = instrument_map.get(cache_key)

    if entry is None:
        # Fallback: scan ±5 strikes for closest match
        fallback_key = _find_closest_strike(index_upper, int(atm_strike), step, opt_type)
        if fallback_key is not None:
            with instrument_map_lock:
                entry = instrument_map[fallback_key]
            logging.info(f"[ATM LOOKUP] {cache_key} not found — closest: {fallback_key}")
            cache_key = fallback_key

    if entry is not None:
        best_token  = entry["token"]
        best_symbol = entry["symbol"]
        logging.info(f"[ATM LOOKUP] {cache_key} → token found")

        # LTP fetch (only network call at trade time)
        import data_fetcher
        option_ltp = data_fetcher.get_ltp(user_id, "NFO", best_symbol, best_token)

        if option_ltp is not None:
            logging.info(f"[ATM FOUND] sym={best_symbol} tok={best_token} ltp={option_ltp}")
            return best_token, best_symbol, float(option_ltp)
        else:
            logging.error(f"[ATM FAILURE] LTP fetch failed for {cache_key} — check broker session")
            return best_token, best_symbol, None

    # ── Complete failure — nothing in cache for this strike ──
    with instrument_map_lock:
        total = len(instrument_map)
        meta = dict(INSTRUMENT_MAP_META)

    logging.error(
        f"[ATM FAILURE]\n\n"
        f"Reason: No matching strike in instrument_map\n\n"
        f"Key: {cache_key}\n"
        f"Index: {index_upper}\n"
        f"Spot LTP: {index_ltp:.2f}\n"
        f"ATM Strike: {atm_strike}\n"
        f"Option Type: {opt_type}\n\n"
        f"Instrument Map: {total} contracts\n"
        f"Nearest Expiry: {meta.get('nearest_expiry')}\n"
        f"Built At: {meta.get('built_at')}\n"
        f"NIFTY Spot (build): {meta.get('nifty_spot')}\n"
        f"BANKNIFTY Spot (build): {meta.get('banknifty_spot')}"
    )
    return None, None, None


# ─────────────────────────────────────────────────────────────
# Kept for compatibility: raw NFO download (used by refresh)
# ─────────────────────────────────────────────────────────────

def download_nfo_instruments(user_id: str) -> pd.DataFrame:
    """Fetch the full NFO instrument list from the Tradejini broker API."""
    logging.info(f"[INSTRUMENT] Downloading NFO instruments via user_id={user_id}")
    try:
        groups = _fetch_symbol_groups(user_id)
        if not groups:
            logging.error("[INSTRUMENT] No symbol groups returned from broker API")
            return pd.DataFrame()

        option_groups = [g for g in groups if _is_option_group(g)]
        logging.info(f"[INSTRUMENT] Found {len(option_groups)} option/NFO symbol groups")

        all_records = []
        for g in option_groups:
            name = g.get("name")
            if not name:
                continue
            scrips = _fetch_group_scrips(name, user_id)
            logging.info(f"[INSTRUMENT] {len(scrips)} scrips fetched for group '{name}'")
            all_records.extend(scrips)

        if not all_records:
            logging.error("[INSTRUMENT] Zero scrips fetched across all option groups")
            return pd.DataFrame()

        df = pd.DataFrame(all_records)
        logging.info(f"[INSTRUMENT] Raw download complete — {len(df)} total rows")
        if not df.empty and "optType" in df.columns:
            logging.info(f"[INSTRUMENT] Unique optTypes: {df['optType'].unique().tolist()[:10]}")
        return df
    except Exception as exc:
        logging.error(f"[INSTRUMENT] download_nfo_instruments error: {exc}")
        return pd.DataFrame()

BASE_URL = "https://api.tradejini.com/v2"

instrument_cache = {}


def _log_auth_check(user_id: str, endpoint: str):
    try:
        from session_manager import get_user_session
        broker_ctx = get_user_session(user_id)
        if broker_ctx:
            token = broker_ctx.get("access_token", "")
            token_prefix = f"{token[:6]}..." if token else "None"
            logging.info(
                f"[AUTH CHECK]\n"
                f"user_id={user_id}\n"
                f"client_id={broker_ctx.get('client_id', '')}\n"
                f"token_prefix={token_prefix}\n"
                f"endpoint={endpoint}"
            )
        else:
            logging.warning(
                f"[AUTH CHECK] FAILED - No active session found\n"
                f"user_id={user_id}\n"
                f"endpoint={endpoint}"
            )
    except Exception as e:
        logging.error(f"Error in auth logging helper: {e}")


def _handle_401(user_id: str, url: str):
    logging.error(
        f"[AUTH FAILURE]\n"
        f"user={user_id}\n"
        f"status=401"
    )
    try:
        from session_manager import invalidate_user_session
        invalidate_user_session(user_id, reason="EXPIRED_TOKEN")
        from error_logger import log_error
        log_error(
            user_id,
            "AUTH_FAILURE",
            "401 Authorization Required: Expired or invalid broker session token.",
            raw={"url": url, "status_code": 401},
            severity="CRITICAL"
        )
    except Exception as e:
        logging.error(f"Error handling 401: {e}")


def _is_auth_error(response: requests.Response) -> bool:
    """
    Return True if the response indicates an authentication or session failure.

    Detects:
      - HTTP 401 status
      - Known auth-failure phrases in the response body (e.g. a 200 response
        whose JSON payload carries AUTH_FAILURE / Invalid Session / Unauthorized).

    Credentials are NEVER read or logged here.
    """
    if response.status_code == 401:
        return True
    try:
        body = response.text.lower()
        return any(phrase in body for phrase in (
            "auth_failure",
            "no active broker session",
            "expired or invalid broker session",
            "invalid session token",
            "unauthorized",
        ))
    except Exception:
        return False


def _headers(user_id: str, content_type: str | None = None) -> dict:
    """
    Build per-user auth headers dynamically.
    Fetches the latest broker_ctx from Supabase.
    """
    from session_manager import get_user_session
    broker_ctx = get_user_session(user_id)
    if not broker_ctx:
        raise ValueError(f"No active broker session for user {user_id}")
    
    headers = {
        "Authorization": f"Bearer {broker_ctx['api_key']}:{broker_ctx['access_token']}",
        "Accept": "application/json",
    }
    if content_type:
        headers["Content-Type"] = content_type
    return headers


def _response_payload(response: requests.Response):
    try:
        return response.json()
    except ValueError:
        return response.text


def _public_get(url: str, params: dict | None = None, timeout: int = 30):
    try:
        response = requests.get(
            url,
            params=params,
            headers={"Accept": "application/json"},
            timeout=timeout,
        )
        if response.status_code == 200:
            return _response_payload(response)
        logging.error(
            f"[API FAIL] GET {url} | Status: {response.status_code} | Response: {response.text}"
        )
    except Exception as exc:
        logging.error(f"[API EXCEPTION] GET {url} | Error: {exc}")
    return None


def _get(path: str, user_id: str, params: dict | None = None):
    url = f"{BASE_URL}{path}"
    _log_auth_check(user_id, path)
    try:
        response = requests.get(url, headers=_headers(user_id), params=params, timeout=15)
        if response.status_code == 200 and not _is_auth_error(response):
            return _response_payload(response)
        elif _is_auth_error(response):
            logging.warning(
                f"[SESSION EXPIRED]\n\n"
                f"User: {user_id}"
            )
            print(f"[SESSION EXPIRED]\nUser: {user_id}", flush=True)
            from session_manager import attempt_broker_auto_login
            if attempt_broker_auto_login(user_id):
                response = requests.get(url, headers=_headers(user_id), params=params, timeout=15)
                if response.status_code == 200:
                    logging.info(
                        f"[REQUEST RETRY SUCCESS]\n\n"
                        f"User: {user_id}"
                    )
                    return _response_payload(response)
            _handle_401(user_id, url)
        else:
            logging.error(
                f"[API FAIL] GET {url} | Status: {response.status_code} | Response: {response.text}"
            )
    except Exception as exc:
        logging.error(f"[API EXCEPTION] GET {url} | Error: {exc}")
    return None


def _post_form(path: str, user_id: str, payload: dict):
    url = f"{BASE_URL}{path}"
    _log_auth_check(user_id, path)
    try:
        response = requests.post(
            url,
            headers=_headers(user_id, "application/x-www-form-urlencoded"),
            data=payload,
            timeout=15,
        )
        if response.status_code == 200 and not _is_auth_error(response):
            return _response_payload(response)
        elif _is_auth_error(response):
            logging.warning(
                f"[SESSION EXPIRED]\n\n"
                f"User: {user_id}"
            )
            print(f"[SESSION EXPIRED]\nUser: {user_id}", flush=True)
            from session_manager import attempt_broker_auto_login
            if attempt_broker_auto_login(user_id):
                response = requests.post(
                    url,
                    headers=_headers(user_id, "application/x-www-form-urlencoded"),
                    data=payload,
                    timeout=15,
                )
                if response.status_code == 200:
                    logging.info(
                        f"[REQUEST RETRY SUCCESS]\n\n"
                        f"User: {user_id}"
                    )
                    return _response_payload(response)
            _handle_401(user_id, url)
        else:
            logging.error(
                f"[API FAIL] POST {url} | Status: {response.status_code} | Response: {response.text}"
            )
    except Exception as exc:
        logging.error(f"[API EXCEPTION] POST {url} | Error: {exc}")
    return None


def _delete(path: str, user_id: str, params: dict):
    url = f"{BASE_URL}{path}"
    _log_auth_check(user_id, path)
    try:
        response = requests.delete(url, headers=_headers(user_id), params=params, timeout=15)
        if response.status_code == 200 and not _is_auth_error(response):
            return _response_payload(response)
        elif _is_auth_error(response):
            logging.warning(
                f"[SESSION EXPIRED]\n\n"
                f"User: {user_id}"
            )
            print(f"[SESSION EXPIRED]\nUser: {user_id}", flush=True)
            from session_manager import attempt_broker_auto_login
            if attempt_broker_auto_login(user_id):
                response = requests.delete(url, headers=_headers(user_id), params=params, timeout=15)
                if response.status_code == 200:
                    logging.info(
                        f"[REQUEST RETRY SUCCESS]\n\n"
                        f"User: {user_id}"
                    )
                    return _response_payload(response)
            _handle_401(user_id, url)
        else:
            logging.error(
                f"[API FAIL] DELETE {url} | Status: {response.status_code} | Response: {response.text}"
            )
    except Exception as exc:
        logging.error(f"[API EXCEPTION] DELETE {url} | Error: {exc}")
    return None


def _extract_rows(payload):
    if isinstance(payload, list):
        return payload

    if isinstance(payload, dict):
        data = payload.get("d")
        if isinstance(data, list):
            return data
        if isinstance(data, dict):
            for key in ("rows", "scripts", "scrips", "items", "symbolStore"):
                value = data.get(key)
                if isinstance(value, list):
                    return value
            return [data]

        data = payload.get("data")
        if isinstance(data, list):
            return data
        if isinstance(data, dict):
            for key in ("rows", "scripts", "scrips", "items"):
                value = data.get(key)
                if isinstance(value, list):
                    return value
            return [data]

    return []


def _parse_csv_rows(csv_text: str) -> list[dict]:
    if not csv_text or not csv_text.strip():
        return []

    reader = csv.DictReader(io.StringIO(csv_text))
    if not reader.fieldnames:
        return []

    return [row for row in reader]


def _normalize_instrument_record(record: dict) -> dict:
    item = dict(record)
    lookup = {str(key).lower(): key for key in record.keys()}

    def pick(*aliases):
        for alias in aliases:
            source_key = lookup.get(alias.lower())
            if source_key is not None:
                return record.get(source_key)
        return None

    item["symId"] = pick("symId", "id", "symbolId") or item.get("symId")
    item["exchange"] = pick("exchange", "exch") or item.get("exchange")
    item["instrument"] = pick("instrument", "inst") or item.get("instrument")
    item["symbol"] = pick("symbol", "underlying", "name") or item.get("symbol")
    item["tradSymbol"] = pick("tradSymbol", "tradingSymbol") or item.get("tradSymbol")
    item["dispSymbol"] = pick("dispSymbol", "displaySymbol") or item.get("dispSymbol")
    item["dispName"] = pick("dispName", "displayname", "dispname") or item.get("dispName")
    item["optType"] = pick("optType", "optionType", "option_type", "opt_type") or item.get("optType")
    item["expiry"] = pick("expiry", "expDate", "expiryDate") or item.get("expiry")
    item["strike"] = pick("strike", "strikePrice") or item.get("strike")
    item["lot"] = pick("lot", "lotsize", "lotSize") or item.get("lot")

    search_parts = [
        item.get("symbol"),
        item.get("tradSymbol"),
        item.get("dispSymbol"),
        item.get("dispName"),
    ]
    item["searchText"] = " ".join(
        str(value).upper() for value in search_parts if value not in (None, "", "nan")
    )
    return item


def _fetch_symbol_groups(user_id: str) -> list[dict]:
    payload = _get("/api/mkt-data/scrips/symbol-store", user_id, params={"version": 0})
    rows = _extract_rows(payload)
    return [row for row in rows if isinstance(row, dict)]


def _is_option_group(group: dict) -> bool:
    name = str(group.get("name", ""))
    id_format = str(group.get("idFormat", ""))
    marker = f"{name} {id_format}".lower()
    return any(token in marker for token in ("strike", "option", "opt", "deriv", "nfo", "fo"))


def _fetch_group_scrips(group_name: str, user_id: str) -> list[dict]:
    url = f"{BASE_URL}/api/mkt-data/scrips/symbol-store/{quote(group_name, safe='')}"
    _log_auth_check(user_id, f"scrips/{group_name}")
    try:
        from session_manager import get_user_session
        broker_ctx = get_user_session(user_id)
        if not broker_ctx:
            return []

        headers = {
            "Authorization": f"Bearer {broker_ctx['api_key']}:{broker_ctx['access_token']}",
            "Accept": "application/json"
        }
        response = requests.get(url, headers=headers, timeout=45)
        if response.status_code == 200:
            payload = _response_payload(response)
            if isinstance(payload, str):
                rows = _parse_csv_rows(payload)
            else:
                rows = _extract_rows(payload)

            return [
                _normalize_instrument_record(row)
                for row in rows
                if isinstance(row, dict)
            ]
        elif response.status_code == 401:
            logging.warning(
                f"[SESSION EXPIRED]\n\n"
                f"User: {user_id}"
            )
            print(f"[SESSION EXPIRED]\nUser: {user_id}", flush=True)
            from session_manager import attempt_broker_auto_login
            if attempt_broker_auto_login(user_id):
                # rebuild headers for retry
                broker_ctx = get_user_session(user_id)
                if broker_ctx:
                    retry_headers = {
                        "Authorization": f"Bearer {broker_ctx['api_key']}:{broker_ctx['access_token']}",
                        "Accept": "application/json"
                    }
                    response = requests.get(url, headers=retry_headers, timeout=45)
                    if response.status_code == 200:
                        logging.info(
                            f"[REQUEST RETRY SUCCESS]\n\n"
                            f"User: {user_id}"
                        )
                        payload = _response_payload(response)
                        if isinstance(payload, str):
                            rows = _parse_csv_rows(payload)
                        else:
                            rows = _extract_rows(payload)
                        return [
                            _normalize_instrument_record(row)
                            for row in rows
                            if isinstance(row, dict)
                        ]
            _handle_401(user_id, url)
        else:
            logging.error(
                f"[SCRIP FAIL] GET {group_name} | Status: {response.status_code} | Response: {response.text}"
            )
    except Exception as exc:
        logging.error(f"[SCRIP EXCEPTION] {group_name} | Error: {exc}")
    return []


# ─────────────────────────────────────────────────────────────
# Instrument status helper (for admin endpoint)
# ─────────────────────────────────────────────────────────────

def get_instrument_status() -> dict:
    """Return a summary of the current instrument_master state."""
    today = datetime.datetime.now(IST).date().isoformat()
    status = {
        "last_refresh_date": str(_INSTRUMENT_STATE.get("last_refresh_date") or "never"),
        "is_refreshing":     _INSTRUMENT_STATE["is_refreshing"],
        "today":             today,
        "total":             0,
        "nifty":             0,
        "banknifty":         0,
    }
    try:
        from supabase_client import supabase
        total_res = (
            supabase.table("instrument_master")
            .select("sym_id", count="exact")
            .eq("updated_date", today)
            .execute()
        )
        status["total"] = total_res.count or 0

        nifty_res = (
            supabase.table("instrument_master")
            .select("sym_id", count="exact")
            .eq("updated_date", today)
            .eq("symbol", "NIFTY")
            .execute()
        )
        status["nifty"] = nifty_res.count or 0

        bnf_res = (
            supabase.table("instrument_master")
            .select("sym_id", count="exact")
            .eq("updated_date", today)
            .eq("symbol", "BANKNIFTY")
            .execute()
        )
        status["banknifty"] = bnf_res.count or 0
    except Exception as exc:
        status["error"] = str(exc)
    return status


def _extract_order_id(payload) -> str | None:
    if not isinstance(payload, dict):
        return None

    for container_key in ("d", "data"):
        container = payload.get(container_key)
        if isinstance(container, dict):
            order_id = container.get("orderId") or container.get("orderid")
            if order_id:
                return str(order_id)

    order_id = payload.get("orderId") or payload.get("orderid")
    return str(order_id) if order_id else None


def verify_broker_order_placed(user_id: str, symboltoken: str, qty: int, side: str, remarks: str) -> str | None:
    """
    Check the broker's order book for a matching order to prevent duplicate execution.
    Looks for orders placed recently (matching symboltoken, qty, side, and remarks).
    Returns the order ID if found, otherwise None.
    """
    try:
        logging.info(f"[ORDER SAFETY] Checking order book for duplicate check... user={user_id} token={symboltoken} side={side}")
        res = _get("/api/oms/orders", user_id)
        orders = _extract_rows(res)

        for order in orders:
            ord_tok = order.get("symId")
            try:
                ord_qty = int(order.get("qty") or 0)
            except ValueError:
                ord_qty = 0

            ord_side = str(order.get("side", "")).lower()
            ord_remarks = str(order.get("remarks", ""))

            # Check matches
            if (str(ord_tok) == str(symboltoken) and 
                int(ord_qty) == int(qty) and 
                ord_side == side.lower() and 
                ord_remarks == remarks):

                status = str(order.get("status", "")).lower()
                if status not in ("rejected", "cancelled", "canceled"):
                    order_id = order.get("orderId") or order.get("orderid")
                    if order_id:
                        logging.info(f"[ORDER SAFETY] Duplicate order verified! Found existing order {order_id} with status {status}")
                        return str(order_id)
    except Exception as exc:
        logging.error(f"[ORDER SAFETY] Error verifying broker state: {exc}")
    return None


def place_order_tradejini(user_id: str, payload: dict) -> dict:
    """
    Central function to place orders with Tradejini.
    Returns structured result: {success, order_id, message, raw}
    NEVER retries order placement.
    If the response is unclear, verifies broker state to prevent duplicate trades.
    """
    def _fail(msg: str, raw=None) -> dict:
        return {"success": False, "order_id": None, "message": msg, "raw": raw}

    # 1. Dynamic Market Protection (mktProt) for MARKET / STOPMARKET orders
    if str(payload.get("type")).lower() in ("market", "stopmarket"):
        try:
            import data_fetcher
            sym_id = payload.get("symId")
            ltp = data_fetcher.get_ltp(user_id, "NFO", "", sym_id)
            if ltp is not None:
                payload["mktProt"] = 10 if float(ltp) < 100 else 5
                logging.info(f"[ORDER] mktProt={payload['mktProt']} for LTP {ltp}")
            else:
                payload["mktProt"] = 5
                logging.warning(f"[ORDER] LTP unavailable for {sym_id} — using mktProt=5")
        except Exception as e:
            payload["mktProt"] = 5
            logging.error(f"[ORDER] mktProt error: {e}")

    # Single attempt placement
    unclear = False
    last_msg = "Unknown error"
    last_raw = None

    try:
        res = _post_form("/api/oms/place-order", user_id, payload)
        logging.info(f"[ORDER RESPONSE] remarks={payload.get('remarks')} | raw={res}")

        if not isinstance(res, dict):
            last_msg = f"Non-dict response: {res}"
            last_raw = res
            unclear = True
        else:
            status = str(res.get("s", "")).lower()
            broker_msg = res.get("msg") or res.get("message") or res.get("errmsg") or "No message from broker"

            if status == "ok":
                order_id = _extract_order_id(res)
                if order_id:
                    logging.info(f"[ORDER SUCCESS] {payload.get('remarks')} | ID: {order_id}")
                    return {"success": True, "order_id": order_id, "message": broker_msg, "raw": res}
                else:
                    last_msg = "Broker returned ok but no order ID"
                    last_raw = res
                    unclear = True
            else:
                last_msg = str(broker_msg)
                last_raw = res
    except Exception as exc:
        last_msg = str(exc)
        last_raw = None
        logging.error(f"[ORDER EXCEPTION] {payload.get('remarks')} | {exc}")
        unclear = True

    # If the outcome was unclear, verify if it actually succeeded on the broker side.
    if unclear:
        existing_order_id = verify_broker_order_placed(
            user_id=user_id,
            symboltoken=payload.get("symId", ""),
            qty=payload.get("qty", 0),
            side=payload.get("side", ""),
            remarks=payload.get("remarks", "")
        )
        if existing_order_id:
            logging.info(f"[ORDER SAFETY] Unclear placement verified as SUCCESS with ID: {existing_order_id}")
            return {"success": True, "order_id": existing_order_id, "message": "Verified from order book", "raw": last_raw}

    logging.error(f"[ORDER FATAL] Placement failed for {payload.get('remarks')} | msg={last_msg}")
    return _fail(last_msg, last_raw)


def place_buy_order(user_id: str, symboltoken: str, symbol: str, qty: int) -> dict:
    """Returns structured result dict from place_order_tradejini."""
    payload = {
        "symId": str(symboltoken),
        "qty": int(qty),
        "side": "buy",
        "type": "market",
        "product": "intraday",
        "validity": "day",
        "remarks": "BOTBUY",
    }
    return place_order_tradejini(user_id, payload)


def place_sl_order(
    user_id: str,
    symboltoken: str,
    symbol: str,
    qty: int,
    trigger_price: float,
) -> dict:
    """Returns structured result dict from place_order_tradejini."""
    payload = {
        "symId": str(symboltoken),
        "qty": int(qty),
        "side": "sell",
        "type": "stopmarket",
        "product": "intraday",
        "trigPrice": round(float(trigger_price), 2),
        "validity": "day",
        "remarks": "BOTSL",
    }
    return place_order_tradejini(user_id, payload)


def place_sell_order(user_id: str, symboltoken: str, symbol: str, qty: int) -> dict:
    """Returns structured result dict from place_order_tradejini."""
    payload = {
        "symId": str(symboltoken),
        "qty": int(qty),
        "side": "sell",
        "type": "market",
        "product": "intraday",
        "validity": "day",
        "remarks": "BOTEXIT",
    }
    return place_order_tradejini(user_id, payload)



def cancel_order(user_id: str, order_id: str) -> bool:
    for attempt in range(1, 4):
        res = _delete("/api/oms/cancel-order", user_id, {"orderId": str(order_id)})
        if isinstance(res, dict) and str(res.get("s", "")).lower() == "ok":
            logging.info(f"[CANCEL] Order {order_id} cancelled (attempt {attempt})")
            return True
        logging.warning(f"[CANCEL] Attempt {attempt} failed | Response: {res}")
        time.sleep(0.5)

    logging.error(f"[CANCEL] Failed after 3 attempts for order {order_id}")
    return False


def is_sl_order_active(user_id: str, order_id: str) -> bool:
    """
    Return True if the SL order is still open or pending in the order list.
    """
    try:
        res = _get("/api/oms/orders", user_id)
        orders = _extract_rows(res)

        for order in orders:
            current_order_id = order.get("orderId") or order.get("orderid")
            if str(current_order_id) != str(order_id):
                continue

            status = str(order.get("status", "")).lower()
            active = status in {"open", "pending", "trigger pending", "open pending"}
            logging.info(f"[SL CHECK] Order {order_id} | status: {status} | active: {active}")
            return active
    except Exception as exc:
        logging.error(f"[SL CHECK] Exception: {exc}")

    return False


def get_order_status(user_id: str, order_id: str) -> dict | None:
    """
    Fetch the full order details for a given order_id.
    """
    try:
        res = _get("/api/oms/orders", user_id)
        orders = _extract_rows(res)

        for order in orders:
            current_order_id = order.get("orderId") or order.get("orderid")
            if str(current_order_id) == str(order_id):
                return order
    except Exception as exc:
        logging.error(f"[ORDER FETCH] Exception: {exc}")

    return None
