"""
data_fetcher.py  –  Market data via Tradejini (CubePlus) v2 API & yfinance.

Verified Endpoint:
    Candle Data : GET /v2/api/mkt-data/chart/interval-data
    LTP         : Derived from latest candle close (no dedicated REST LTP endpoint)

Auth header:
    Authorization: Bearer <API_KEY>:<access_token>

broker_ctx = {"access_token": str, "client_id": str}
"""

import requests
import pandas as pd
import datetime
import logging
import pytz
import time
import yfinance as yf
import config
import threading

BASE_URL = "https://api.tradejini.com/v2"

INTERVAL_MAP = {
    "FIVE_MINUTE": "5",
    "ONE_MINUTE":  "1",
    "15_MINUTE":   "15",
    "ONE_HOUR":    "60",
    "ONE_DAY":     "1D",
}

INDEX_MAP = {
    "NIFTY":     {"yf": "^NSEI",    "token": "99926000"},
    "BANKNIFTY": {"yf": "^NSEBANK", "token": "99926009"},
}

INDEX_YF_MAP = {
    "99926000": "^NSEI",
    "99926009": "^NSEBANK"
}

# Simple cache dictionary to avoid redundant yfinance calls within the same cycle
_yf_cache = {}

# Last known-good yfinance DataFrames keyed by ticker – used as fallback
_yf_last_valid: dict = {}

# Centralized caches for Market Data Engine
MARKET_DATA_CACHE = {
    "NIFTY": None,
    "BANKNIFTY": None,
    "updated_at": None
}

MARKET_LTP_CACHE = {
    "NIFTY": None,
    "BANKNIFTY": None
}

SHARED_SETUPS = {
    "NIFTY": {
        "strategy_one": None,
        "strategy_two": None
    },
    "BANKNIFTY": {
        "strategy_one": None,
        "strategy_two": None
    }
}

SHARED_SIGNALS = {
    "NIFTY": {
        "strategy_one": None,
        "strategy_two": None
    },
    "BANKNIFTY": {
        "strategy_one": None,
        "strategy_two": None
    }
}

market_cache_lock = threading.Lock()
_engine_started = False
_engine_lock = threading.Lock()


def start_market_data_engine():
    global _engine_started
    with _engine_lock:
        if not _engine_started:
            t = threading.Thread(target=_market_data_engine_loop, daemon=True)
            t.start()
            _engine_started = True
            logging.info("[MARKET ENGINE] Central Market Data Engine thread started.")


def _market_data_engine_loop():
    import strategy_one
    import strategy_two

    logging.info("[MARKET ENGINE] Initializing historical data for NIFTY & BANKNIFTY...")
    nifty_df = initialize_hybrid_ema("NIFTY")
    banknifty_df = initialize_hybrid_ema("BANKNIFTY")

    with market_cache_lock:
        MARKET_DATA_CACHE["NIFTY"] = nifty_df
        MARKET_DATA_CACHE["BANKNIFTY"] = banknifty_df
        MARKET_DATA_CACHE["updated_at"] = datetime.datetime.now()
        if nifty_df is not None and not nifty_df.empty:
            MARKET_LTP_CACHE["NIFTY"] = float(nifty_df['close'].iloc[-1])
        if banknifty_df is not None and not banknifty_df.empty:
            MARKET_LTP_CACHE["BANKNIFTY"] = float(banknifty_df['close'].iloc[-1])

    last_candle_time = {
        "NIFTY": {"strategy_one": None, "strategy_two": None},
        "BANKNIFTY": {"strategy_one": None, "strategy_two": None}
    }

    while True:
        try:
            time.sleep(5)

            # Central fetch log
            logging.info(
                f"[YFINANCE FETCH]\n\n"
                f"Executed by:\n"
                f"Market Data Engine\n\n"
                f"Not by individual users."
            )

            ist = pytz.timezone('Asia/Kolkata')
            now = datetime.datetime.now(ist)

            # Fetch NIFTY & BANKNIFTY
            for index_name, ticker in [("NIFTY", "^NSEI"), ("BANKNIFTY", "^NSEBANK")]:
                df_5m_new = safe_yf_download(ticker, interval="5m", period="1d")
                df_1m = safe_yf_download(ticker, interval="1m", period="1d")

                live_ltp = None
                if not df_1m.empty:
                    if isinstance(df_1m.columns, pd.MultiIndex):
                        df_1m.columns = df_1m.columns.get_level_values(0)
                    live_ltp = float(df_1m['Close'].iloc[-1])

                with market_cache_lock:
                    current_df = MARKET_DATA_CACHE[index_name]

                    # Process 5m candles update
                    if not df_5m_new.empty:
                        if isinstance(df_5m_new.columns, pd.MultiIndex):
                            df_5m_new.columns = df_5m_new.columns.get_level_values(0)
                        df_5m_new = df_5m_new[['Open', 'High', 'Low', 'Close', 'Volume']].copy()
                        df_5m_new.columns = ['open', 'high', 'low', 'close', 'volume']

                        if df_5m_new.index.tz is None:
                            df_5m_new['timestamp_ist'] = df_5m_new.index.tz_localize('Asia/Kolkata')
                        else:
                            df_5m_new['timestamp_ist'] = df_5m_new.index.tz_convert('Asia/Kolkata')

                        last_ts = df_5m_new['timestamp_ist'].iloc[-1]
                        if now < (last_ts + datetime.timedelta(minutes=5)):
                            df_5m_new = df_5m_new.iloc[:-1]

                        if not df_5m_new.empty and current_df is not None:
                            last_global_ts = current_df['timestamp_ist'].iloc[-1]
                            new_candles = df_5m_new[df_5m_new['timestamp_ist'] > last_global_ts]
                            if not new_candles.empty:
                                k = 2 / (5 + 1)
                                for idx, row in new_candles.iterrows():
                                    last_ema = current_df['EMA5'].iloc[-1]
                                    new_ema  = (row['close'] * k) + (last_ema * (1 - k))
                                    row = row.copy()
                                    row['EMA5'] = new_ema
                                    current_df.loc[idx] = row
                                MARKET_DATA_CACHE[index_name] = current_df
                                _yf_last_valid[ticker] = current_df

                    if live_ltp is not None:
                        MARKET_LTP_CACHE[index_name] = live_ltp
                    elif MARKET_LTP_CACHE[index_name] is None and current_df is not None and not current_df.empty:
                        MARKET_LTP_CACHE[index_name] = float(current_df['close'].iloc[-1])

            # Update cache timestamp
            with market_cache_lock:
                MARKET_DATA_CACHE["updated_at"] = datetime.datetime.now()
                nifty_rows = len(MARKET_DATA_CACHE["NIFTY"]) if MARKET_DATA_CACHE["NIFTY"] is not None else 0
                banknifty_rows = len(MARKET_DATA_CACHE["BANKNIFTY"]) if MARKET_DATA_CACHE["BANKNIFTY"] is not None else 0

            logging.info(
                f"[MARKET CACHE UPDATE]\n\n"
                f"NIFTY Rows: {nifty_rows}\n\n"
                f"BANKNIFTY Rows: {banknifty_rows}\n\n"
                f"Updated: {MARKET_DATA_CACHE['updated_at']}"
            )

            # Central strategy check
            for index_name in ["NIFTY", "BANKNIFTY"]:
                with market_cache_lock:
                    df = MARKET_DATA_CACHE[index_name]
                    live_ltp = MARKET_LTP_CACHE[index_name]

                if df is None or len(df) < 5:
                    continue

                recent_df = df.tail(5)

                # Strategy One
                is_setup_valid, s_low, s_high, s_ema, s_time = strategy_one.get_setup_levels(recent_df)
                _update_shared_setup_and_signals(
                    index_name, "strategy_one", is_setup_valid, s_low, s_high, s_ema, s_time, live_ltp, last_candle_time
                )

                # Strategy Two
                is_setup_valid_s2, s_low_s2, s_high_s2, s_ema_s2, s_time_s2, candle_size = strategy_two.get_setup_levels(recent_df)
                _update_shared_setup_and_signals(
                    index_name, "strategy_two", is_setup_valid_s2, s_low_s2, s_high_s2, s_ema_s2, s_time_s2, live_ltp, last_candle_time
                )

        except Exception as err:
            logging.error(f"[MARKET ENGINE] Error in loop: {err}", exc_info=True)


def _update_shared_setup_and_signals(
    index_name: str,
    strategy: str,
    is_setup_valid: bool,
    s_low: float,
    s_high: float,
    s_ema: float,
    s_time,
    live_ltp: float | None,
    last_candle_time: dict
):
    with market_cache_lock:
        last_t = last_candle_time[index_name][strategy]
        if s_time != last_t:
            last_candle_time[index_name][strategy] = s_time
            SHARED_SETUPS[index_name][strategy] = None
            if is_setup_valid:
                SHARED_SETUPS[index_name][strategy] = {
                    "low": s_low,
                    "high": s_high,
                    "ema": s_ema,
                    "time": s_time
                }
                logging.info(f"[MARKET ENGINE] Setup detected for {index_name} {strategy} at low {s_low}")
            else:
                logging.info(f"[MARKET ENGINE] No setup detected for {index_name} {strategy} on new candle")

        setup = SHARED_SETUPS[index_name][strategy]
        if setup:
            s_time_dt = setup['time']
            s_time_naive = s_time_dt.replace(tzinfo=None) if hasattr(s_time_dt, 'replace') else s_time_dt
            ist = pytz.timezone('Asia/Kolkata')
            now_ist = datetime.datetime.now(ist).replace(tzinfo=None)

            time_diff = (now_ist - s_time_naive).total_seconds()
            if time_diff > 1800:
                logging.info(f"[MARKET ENGINE] Setup expired for {index_name} {strategy}. Clearing.")
                SHARED_SETUPS[index_name][strategy] = None
                setup = None

        if setup and live_ltp is not None:
            if live_ltp < setup['low']:
                logging.info(f"[MARKET ENGINE] Breakdown triggered for {index_name} {strategy} at {live_ltp:.2f}")
                SHARED_SIGNALS[index_name][strategy] = {
                    "symbol": index_name,
                    "direction": "PE",
                    "entry_price": live_ltp,
                    "strategy": strategy,
                    "timestamp": time.time(),
                    "setup": setup
                }
                # Clear the setup once triggered
                SHARED_SETUPS[index_name][strategy] = None


def safe_yf_download(
    ticker: str,
    interval: str,
    period: str,
    retries: int = 3,
    delay: int = 2,
) -> pd.DataFrame:
    """
    Wrapper around yf.download that retries on empty responses.

    Returns the first non-empty DataFrame within *retries* attempts.
    If every attempt returns an empty frame, returns an empty DataFrame
    (caller decides whether to fall back to cached data).
    """
    for attempt in range(1, retries + 1):
        try:
            df = yf.download(ticker, interval=interval, period=period, progress=False)
        except Exception as exc:
            logging.warning(
                f"[YFINANCE RETRY]\n"
                f"Ticker: {ticker}\n"
                f"Attempt: {attempt}/{retries}\n"
                f"Exception: {exc}"
            )
            df = pd.DataFrame()

        if not df.empty:
            logging.info(
                f"[YFINANCE SUCCESS]\n"
                f"Ticker: {ticker}\n"
                f"Rows: {len(df)}"
            )
            return df

        # Empty response – log and decide whether to retry
        if attempt < retries:
            logging.warning(
                f"[YFINANCE RETRY]\n"
                f"Ticker: {ticker}\n"
                f"Attempt: {attempt}/{retries}"
            )
            time.sleep(delay)
        else:
            logging.error(
                f"[YFINANCE FAILED]\n"
                f"Ticker: {ticker}\n"
                f"Attempts: {retries}\n"
                f"Reason: Empty dataframe after retries"
            )

    return pd.DataFrame()

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


def _headers(user_id: str) -> dict:
    """
    Build per-user auth headers dynamically.
    Fetches isolated session.
    """
    from session_manager import get_user_session
    broker_ctx = get_user_session(user_id)
    if not broker_ctx:
        raise ValueError(f"No active broker session for user {user_id}")
        
    return {
        "Authorization": f"Bearer {broker_ctx['api_key']}:{broker_ctx['access_token']}",
        "Content-Type": "application/json",
    }

# ── EMA seed via yfinance (broker-agnostic, logic unchanged) ──

def initialize_hybrid_ema(index_name: str = "NIFTY"):
    logging.info(f"Initializing Hybrid EMA for {index_name} using yfinance...")
    try:
        ticker = INDEX_MAP.get(index_name, INDEX_MAP["NIFTY"])["yf"]
        df = safe_yf_download(ticker, interval="5m", period="5d")

        if df.empty:
            logging.error("Failed to download yfinance data.")
            return None

        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)

        df = df[['Open', 'High', 'Low', 'Close', 'Volume']].copy()
        df.columns = ['open', 'high', 'low', 'close', 'volume']

        if df.index.tz is None:
            df.index = df.index.tz_localize('Asia/Kolkata')
        else:
            df.index = df.index.tz_convert('Asia/Kolkata')

        df['timestamp_ist'] = df.index
        ist = pytz.timezone('Asia/Kolkata')
        now = datetime.datetime.now(ist)
        last_ts = df['timestamp_ist'].iloc[-1]

        if now < (last_ts + datetime.timedelta(minutes=5)):
            df = df.iloc[:-1]   # remove still-forming candle

        if df.empty:
            logging.error("No completed 5-minute candles available for EMA seed.")
            return None

        df['EMA5'] = df['close'].ewm(span=5, adjust=False).mean()
        logging.info("EMA5 initialized from yfinance.")
        return df

    except Exception as e:
        logging.error(f"yfinance init error: {e}")
        return None

# ── Live candle refresh ────────────────────────────────────────

def update_hybrid_ema(
    global_df: pd.DataFrame,
    user_id: str,
    exchange: str,
    symboltoken: str,
    interval: str = "FIVE_MINUTE",
):
    """Fetch latest 5-min candles, append to global_df, update EMA5."""
    ist = pytz.timezone('Asia/Kolkata')
    now = datetime.datetime.now(ist)
    now_ts = int(time.time())

    is_index = symboltoken in INDEX_YF_MAP

    if is_index:
        ticker = INDEX_YF_MAP[symboltoken]
        cache_key = f"{ticker}_5m"
        cached_data = _yf_cache.get(cache_key)
        
        if cached_data and (now_ts - cached_data['ts']) < 5:
            df_new = cached_data['df']
        else:
            try:
                df_new = safe_yf_download(ticker, interval="5m", period="1d")

                if df_new.empty:
                    # All retries exhausted – attempt fallback to last valid data
                    fallback = _yf_last_valid.get(ticker)
                    if fallback is not None:
                        logging.warning(
                            f"[YFINANCE FALLBACK]\n"
                            f"Ticker: {ticker}\n"
                            f"Using last valid cached dataframe ({len(fallback)} rows)"
                        )
                        df_new = fallback
                    else:
                        logging.error(
                            f"[DATA ERROR] yfinance empty for {ticker} and no fallback available"
                        )
                        return False, global_df

                if isinstance(df_new.columns, pd.MultiIndex):
                    df_new.columns = df_new.columns.get_level_values(0)

                df_new = df_new[['Open', 'High', 'Low', 'Close', 'Volume']].copy()
                df_new.columns = ['open', 'high', 'low', 'close', 'volume']

                if df_new.index.tz is None:
                    df_new['timestamp_ist'] = df_new.index.tz_localize('Asia/Kolkata')
                else:
                    df_new['timestamp_ist'] = df_new.index.tz_convert('Asia/Kolkata')

                # Trim forming candle
                last_ts = df_new['timestamp_ist'].iloc[-1]
                if now < (last_ts + datetime.timedelta(minutes=5)):
                    df_new = df_new.iloc[:-1]

                if df_new.empty:
                    return False, global_df

                # Persist as last-known-good before caching
                _yf_last_valid[ticker] = df_new
                _yf_cache[cache_key] = {'ts': now_ts, 'df': df_new}
            except Exception as e:
                logging.error(f"[DATA EXCEPTION] yfinance {ticker}: {e}")
                return False, global_df
            
    else:
        # Tradejini for options
        from_ts = now_ts - 86400 # Last 24 hours
        symbol_id = symboltoken

        url = f"{BASE_URL}/api/mkt-data/chart/interval-data"
        params = {
            "id": symbol_id, 
            "interval": "5", 
            "from": from_ts, 
            "to": now_ts
        }

        try:
            _log_auth_check(user_id, "market_data")
            response = requests.get(url, headers=_headers(user_id), params=params, timeout=10)
            if response.status_code == 200:
                data = response.json()
                if not data or data.get("s") == "no-data":
                    return False, global_df

                res_d = data.get("d", {})
                bars = res_d.get("bars", [])

                if not bars:
                    return False, global_df

                df_new = pd.DataFrame(bars, columns=['time', 'open', 'high', 'low', 'close', 'volume', 'oi'])
                df_new['timestamp_ist'] = pd.to_datetime(df_new['time'], unit='ms').dt.tz_localize('UTC').dt.tz_convert('Asia/Kolkata')
                df_new.set_index('timestamp_ist', inplace=True, drop=False)
                df_new = df_new[['timestamp_ist', 'open', 'high', 'low', 'close', 'volume']]
            elif _is_auth_error(response):
                logging.warning(
                    f"[SESSION EXPIRED]\n\n"
                    f"User: {user_id}"
                )
                print(f"[SESSION EXPIRED]\nUser: {user_id}", flush=True)
                from session_manager import attempt_broker_auto_login
                if attempt_broker_auto_login(user_id):
                    # Retry once with fresh token
                    response = requests.get(url, headers=_headers(user_id), params=params, timeout=10)
                    if response.status_code == 200:
                        logging.info(
                            f"[REQUEST RETRY SUCCESS]\n\n"
                            f"User: {user_id}"
                        )
                        data = response.json()
                        if not data or data.get("s") == "no-data":
                            return False, global_df
                        res_d = data.get("d", {})
                        bars = res_d.get("bars", [])
                        if not bars:
                            return False, global_df
                        df_new = pd.DataFrame(bars, columns=['time', 'open', 'high', 'low', 'close', 'volume', 'oi'])
                        df_new['timestamp_ist'] = pd.to_datetime(df_new['time'], unit='ms').dt.tz_localize('UTC').dt.tz_convert('Asia/Kolkata')
                        df_new.set_index('timestamp_ist', inplace=True, drop=False)
                        df_new = df_new[['timestamp_ist', 'open', 'high', 'low', 'close', 'volume']]
                    else:
                        _handle_401(user_id, url)
                        return False, global_df
                else:
                    _handle_401(user_id, url)
                    return False, global_df
            else:
                logging.error(f"[DATA ERROR] Tradejini {symbol_id} | Status: {response.status_code} | Response: {response.text}")
                return False, global_df
        except Exception as e:
            logging.error(f"[DATA EXCEPTION] Tradejini {symbol_id}: {e}")
            return False, global_df
        
    # Merge and update EMA
    last_global_ts = global_df['timestamp_ist'].iloc[-1]
    new_candles = df_new[df_new['timestamp_ist'] > last_global_ts]
    
    if not new_candles.empty:
        k = 2 / (5 + 1)
        for idx, row in new_candles.iterrows():
            last_ema = global_df['EMA5'].iloc[-1]
            new_ema  = (row['close'] * k) + (last_ema * (1 - k))
            row = row.copy()
            row['EMA5'] = new_ema
            # Use .loc[idx] to append/update while preserving the DatetimeIndex
            global_df.loc[idx] = row
        
        logging.info(f"Successfully updated EMA5 for {symboltoken}")
        return True, global_df
    
    return False, global_df


# ── Live LTP ───────────────────────────────────────────────────

def get_ltp(
    user_id: str,
    exchange: str,
    symbol: str,
    symboltoken: str,
) -> float | None:
    """
    Return the live last-traded price.
    Uses yfinance for indices, Tradejini v2 chart API for options.
    """
    now_ts = int(time.time())
    is_index = symboltoken in INDEX_YF_MAP
    
    if is_index:
        ticker = INDEX_YF_MAP[symboltoken]
        index_name = "NIFTY" if ticker == "^NSEI" else "BANKNIFTY"

        logging.info(
            f"[MARKET CACHE HIT]\n\n"
            f"User: {user_id}\n\n"
            f"Source:\nShared Cache"
        )
        with market_cache_lock:
            return MARKET_LTP_CACHE.get(index_name)
        
    else:
        from_ts = now_ts - 600  # last 10 minutes
        symbol_id = symboltoken

        url = f"{BASE_URL}/api/mkt-data/chart/interval-data"
        params = {
            "id": symbol_id,
            "interval": "1",
            "from": from_ts,
            "to": now_ts,
        }

        from session_manager import get_user_session
        broker_ctx = get_user_session(user_id)
        token_prefix = "None"
        client_id = "None"
        if broker_ctx:
            tok = broker_ctx.get("access_token", "")
            token_prefix = f"{tok[:6]}..." if tok else "None"
            client_id = broker_ctx.get("client_id", "")
        
        logging.info(
            f"[LTP FETCH]\n"
            f"user={user_id}\n"
            f"token={token_prefix}\n"
            f"client={client_id}"
        )

        for attempt in range(3):
            try:
                time.sleep(0.3)
                _log_auth_check(user_id, "market_data")
                response = requests.get(
                    url, headers=_headers(user_id), params=params, timeout=10
                )
                if response.status_code == 200:
                    res = response.json()
                    bars = res.get("d", {}).get("bars", [])

                    if bars:
                        # Tradejini format: [time, open, high, low, close, volume, oi]
                        return float(bars[-1][4])
                    else:
                        logging.error(f"[LTP NFO] No bars in response for token={symbol_id} | raw={res}")
                elif _is_auth_error(response):
                    logging.warning(
                        f"[SESSION EXPIRED]\n\n"
                        f"User: {user_id}"
                    )
                    print(f"[SESSION EXPIRED]\nUser: {user_id}", flush=True)
                    from session_manager import attempt_broker_auto_login
                    if attempt_broker_auto_login(user_id):
                        # Retry once with fresh token
                        response = requests.get(
                            url, headers=_headers(user_id), params=params, timeout=10
                        )
                        if response.status_code == 200:
                            logging.info(
                                f"[REQUEST RETRY SUCCESS]\n\n"
                                f"User: {user_id}"
                            )
                            res = response.json()
                            bars = res.get("d", {}).get("bars", [])
                            if bars:
                                return float(bars[-1][4])
                            else:
                                logging.error(f"[LTP NFO] No bars after retry for token={symbol_id}")
                        else:
                            _handle_401(user_id, url)
                            break
                    else:
                        _handle_401(user_id, url)
                        break
                else:
                    logging.error(f"[FETCH ERROR] Status: {response.status_code} | Token: {symbol_id} | Text: {response.text}")

            except Exception as e:
                logging.error(f"[FETCH EXCEPTION] token={symbol_id} | {e}")
                if 'response' in locals():
                    logging.error(f"Raw Response: {response.text}")
                time.sleep(1)

        logging.error(f"[LTP NFO] All attempts failed or auth failure for token={symbol_id}")
        return None
