"""
Tradejini (CubePlus) instrument and order helpers.
"""

import csv
import datetime
import io
import logging
import time
from urllib.parse import quote

import pandas as pd
import requests

BASE_URL = "https://api.tradejini.com/v2"

instrument_cache = {}


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
    try:
        response = requests.get(url, headers=_headers(user_id), params=params, timeout=15)
        if response.status_code == 200:
            return _response_payload(response)
        logging.error(
            f"[API FAIL] GET {url} | Status: {response.status_code} | Response: {response.text}"
        )
    except Exception as exc:
        logging.error(f"[API EXCEPTION] GET {url} | Error: {exc}")
    return None


def _post_form(path: str, user_id: str, payload: dict):
    url = f"{BASE_URL}{path}"
    try:
        response = requests.post(
            url,
            headers=_headers(user_id, "application/x-www-form-urlencoded"),
            data=payload,
            timeout=15,
        )
        if response.status_code == 200:
            return _response_payload(response)
        logging.error(
            f"[API FAIL] POST {url} | Status: {response.status_code} | Response: {response.text}"
        )
    except Exception as exc:
        logging.error(f"[API EXCEPTION] POST {url} | Error: {exc}")
    return None


def _delete(path: str, user_id: str, params: dict):
    url = f"{BASE_URL}{path}"
    try:
        response = requests.delete(url, headers=_headers(user_id), params=params, timeout=15)
        if response.status_code == 200:
            return _response_payload(response)
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
    item["optType"] = pick("optType", "optionType", "option_type", "opt_type") or item.get("optType")
    item["expiry"] = pick("expiry", "expDate", "expiryDate") or item.get("expiry")
    item["strike"] = pick("strike", "strikePrice") or item.get("strike")
    item["lot"] = pick("lot", "lotsize", "lotSize") or item.get("lot")

    search_parts = [
        item.get("symbol"),
        item.get("tradSymbol"),
        item.get("dispSymbol"),
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
        if response.status_code != 200:
            logging.error(
                f"[SCRIP FAIL] GET {group_name} | Status: {response.status_code} | Response: {response.text}"
            )
            return []

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
    except Exception as exc:
        logging.error(f"[SCRIP EXCEPTION] {group_name} | Error: {exc}")
        return []


def get_instrument_list(user_id: str) -> pd.DataFrame:
    """
    Download option-capable scrip master data and cache it per user.
    """
    global instrument_cache
    now = time.time()

    if user_id in instrument_cache:
        cached_data = instrument_cache[user_id]
        if (now - cached_data["loaded_at"]) < 900:  # 15 minutes
            return cached_data["data"].copy()

    groups = _fetch_symbol_groups(user_id)
    if not groups:
        logging.error(f"[INSTRUMENTS] Failed to fetch symbol store groups for {user_id}.")
        return pd.DataFrame()

    option_groups = [group for group in groups if _is_option_group(group)]
    target_groups = option_groups or groups

    records: list[dict] = []
    for group in target_groups:
        group_name = group.get("name")
        if not group_name:
            continue
        rows = _fetch_group_scrips(str(group_name), user_id)
        if rows:
            records.extend(rows)

    if not records and option_groups:
        logging.warning("[INSTRUMENTS] Option-group fetch returned nothing. Falling back to all groups.")
        for group in groups:
            group_name = group.get("name")
            if not group_name:
                continue
            rows = _fetch_group_scrips(str(group_name), user_id)
            if rows:
                records.extend(rows)

    if not records:
        logging.error(f"[INSTRUMENTS] No scrip records were loaded for {user_id}.")
        return pd.DataFrame()

    df = pd.DataFrame(records)
    if "symId" in df.columns:
        df = df[df["symId"].notna()].drop_duplicates(subset=["symId"]).reset_index(drop=True)
    else:
        df = df.drop_duplicates().reset_index(drop=True)

    instrument_cache[user_id] = {
        "data": df,
        "loaded_at": now
    }
    
    expiry_log = "N/A"
    if not df.empty and "expiry" in df.columns:
        try:
            df_opt = df[df["expiry"].notna()].copy()
            df_opt["expiry_dt"] = pd.to_datetime(df_opt["expiry"], errors="coerce")
            today = pd.Timestamp(datetime.date.today())
            df_opt = df_opt[df_opt["expiry_dt"] >= today].sort_values("expiry_dt")
            if not df_opt.empty:
                expiry_log = df_opt.iloc[0]["expiry_dt"].strftime('%Y-%m-%d')
        except Exception:
            pass

    logging.info(f"[INSTRUMENT LOAD]\nUser: {user_id}\nLoaded Instruments: {len(df)}\nExpiry: {expiry_log}")
    return df.copy()


def _filter_index_rows(df_inst: pd.DataFrame, index_name: str) -> pd.Series:
    search = df_inst.get("searchText", pd.Series("", index=df_inst.index)).fillna("").astype(str)
    upper_name = index_name.upper()

    if upper_name == "BANKNIFTY":
        return search.str.contains("BANKNIFTY", na=False)

    if upper_name == "NIFTY":
        blocked = ("BANKNIFTY", "FINNIFTY", "MIDCPNIFTY")
        mask = search.str.contains("NIFTY", na=False)
        for token in blocked:
            mask &= ~search.str.contains(token, na=False)
        return mask

    return search.str.contains(upper_name, na=False)


def select_atm_option(
    user_id: str,
    df_inst: pd.DataFrame,
    index_ltp: float,
    index_name: str = "NIFTY",
):
    """
    Select the nearest-expiry ATM PE option and fetch its latest price.

    Returns (symId, display_symbol, ltp) or (None, None, None).
    """
    try:
        if df_inst is None or df_inst.empty:
            logging.error("[ATM ERROR] Instrument DataFrame is empty.")
            return None, None, None

        step = 50 if index_name.upper() == "NIFTY" else 100
        atm_strike = round(index_ltp / step) * step
        
        df_opt = df_inst.copy()

        if "exchange" in df_opt.columns:
            df_opt = df_opt[df_opt["exchange"].astype(str).str.upper() == "NFO"]

        if "instrument" in df_opt.columns:
            df_opt = df_opt[df_opt["instrument"].astype(str).str.upper().str.contains("OPT", na=False)]

        df_opt = df_opt[_filter_index_rows(df_opt, index_name)]

        if "optType" in df_opt.columns:
            df_opt = df_opt[df_opt["optType"].astype(str).str.upper().str.strip() == "PE"]
        else:
            df_opt = df_opt[
                df_opt.get("searchText", pd.Series("", index=df_opt.index))
                .astype(str)
                .str.upper()
                .str.endswith("PE")
            ]

        if df_opt.empty:
            logging.info(df_inst.head(10))
            return None, None, None

        df_opt["expiry_dt"] = pd.to_datetime(df_opt["expiry"], errors="coerce")
        today = pd.Timestamp(datetime.date.today())
        df_opt = df_opt[df_opt["expiry_dt"].notna()]
        df_opt = df_opt[df_opt["expiry_dt"] >= today].sort_values("expiry_dt")

        if df_opt.empty:
            logging.info(df_inst.head(10))
            return None, None, None

        closest_expiry = df_opt.iloc[0]["expiry_dt"]
        nearest_expiry_str = closest_expiry.strftime('%Y-%m-%d')

        logging.info(f"[ATM DEBUG]\nUser: {user_id}\nIndex: {index_ltp}\nATM: {atm_strike}\nOption Type: PE\nNearest Expiry: {nearest_expiry_str}\nTotal Symbols: {len(df_inst)}")

        df_weekly = df_opt[df_opt["expiry_dt"] == closest_expiry].copy()

        df_weekly["strike_num"] = pd.to_numeric(df_weekly["strike"], errors="coerce")
        df_weekly["strike_norm"] = df_weekly["strike_num"].where(
            df_weekly["strike_num"].abs() < 100000,
            df_weekly["strike_num"] / 100.0,
        )
        df_weekly = df_weekly[df_weekly["strike_norm"].notna()]

        if df_weekly.empty:
            logging.info(df_inst.head(10))
            return None, None, None

        df_weekly["strike_diff"] = (df_weekly["strike_norm"] - float(atm_strike)).abs()
        match = df_weekly.sort_values(["strike_diff", "expiry_dt"]).iloc[0]

        best_token = str(match["symId"])
        best_symbol = str(
            match.get("tradSymbol")
            or match.get("dispSymbol")
            or match.get("symbol")
            or best_token
        )

        import data_fetcher

        option_ltp = data_fetcher.get_ltp(user_id, "NFO", best_symbol, best_token)
        if option_ltp is None:
            logging.info(df_inst.head(10))
            return None, None, None

        logging.info(f"[ATM FOUND]\nUser: {user_id}\nSymbol: {best_symbol}\nToken: {best_token}\nLTP: {option_ltp}")
        return best_token, best_symbol, float(option_ltp)

    except Exception as exc:
        logging.error(f"[CRITICAL ATM ERROR] {exc}")
        if df_inst is not None and not df_inst.empty:
            logging.info(df_inst.head(10))
        return None, None, None


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


def place_order_tradejini(user_id: str, payload: dict) -> dict:
    """
    Central function to place orders with Tradejini.
    Returns structured result: {success, order_id, message, raw}
    NEVER returns a false success — always validates "s": "ok" in response.
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

    # 2. Retry logic — 3 attempts
    last_msg = "Unknown error"
    last_raw = None
    for attempt in range(1, 4):
        try:
            res = _post_form("/api/oms/place-order", user_id, payload)

            # Always log raw response for debugging
            logging.info(f"[ORDER RESPONSE] attempt={attempt} | remarks={payload.get('remarks')} | raw={res}")

            if not isinstance(res, dict):
                last_msg = f"Non-dict response: {res}"
                last_raw = res
                logging.error(f"[ORDER FAIL] {payload.get('remarks')} | attempt {attempt} | {last_msg}")
                time.sleep(1)
                continue

            # 3. Strict validation — must have "s": "ok"
            status = str(res.get("s", "")).lower()
            broker_msg = res.get("msg") or res.get("message") or res.get("errmsg") or "No message from broker"

            if status == "ok":
                order_id = _extract_order_id(res)
                if order_id:
                    logging.info(f"[ORDER SUCCESS] {payload.get('remarks')} | ID: {order_id}")
                    return {"success": True, "order_id": order_id, "message": broker_msg, "raw": res}
                # "ok" but no order ID — treat as failure
                last_msg = "Broker returned ok but no order ID"
                last_raw = res
                logging.error(f"[ORDER FAIL] {payload.get('remarks')} | {last_msg} | raw={res}")
            else:
                last_msg = str(broker_msg)
                last_raw = res
                logging.error(f"[ORDER FAIL] {payload.get('remarks')} | attempt {attempt} | broker_status={status} | msg={last_msg}")

        except Exception as exc:
            last_msg = str(exc)
            logging.error(f"[ORDER EXCEPTION] {payload.get('remarks')} | attempt {attempt} | {exc}")

        if attempt < 3:
            time.sleep(1)

    logging.error(f"[ORDER FATAL] All 3 attempts failed for {payload.get('remarks')} | last_msg={last_msg}")
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
