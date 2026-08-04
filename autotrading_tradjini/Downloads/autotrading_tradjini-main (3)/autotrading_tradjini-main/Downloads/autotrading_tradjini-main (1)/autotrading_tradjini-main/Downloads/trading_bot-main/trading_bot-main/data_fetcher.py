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
import strategy_three

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
        "strategy_two": None,
        "strategy_three": None
    },
    "BANKNIFTY": {
        "strategy_one": None,
        "strategy_two": None,
        "strategy_three": None
    }
}

SHARED_SIGNALS = {
    "NIFTY": {
        "strategy_one": None,
        "strategy_two": None,
        "strategy_three": None
    },
    "BANKNIFTY": {
        "strategy_one": None,
        "strategy_two": None,
        "strategy_three": None
    }
}

STRATEGY_THREE_STATE = {
    "NIFTY": {
        "last_processed_setup": None,
        "CE": {
            "state": "WAIT_SETUP",
            "setup_timestamp": None,
            "setup_low": None,
            "setup_high": None,
            "setup_ema": None,
            "current_stoploss": None,
            "trade_active": False,
            "option_symbol": None,
            "option_token": None,
            "atm_strike": None,
            "last_processed_setup": None,
            "last_exit_timestamp": None
        },
        "PE": {
            "state": "WAIT_SETUP",
            "setup_timestamp": None,
            "setup_low": None,
            "setup_high": None,
            "setup_ema": None,
            "current_stoploss": None,
            "trade_active": False,
            "option_symbol": None,
            "option_token": None,
            "atm_strike": None,
            "last_processed_setup": None,
            "last_exit_timestamp": None
        }
    },
    "BANKNIFTY": {
        "last_processed_setup": None,
        "CE": {
            "state": "WAIT_SETUP",
            "setup_timestamp": None,
            "setup_low": None,
            "setup_high": None,
            "setup_ema": None,
            "current_stoploss": None,
            "trade_active": False,
            "option_symbol": None,
            "option_token": None,
            "atm_strike": None,
            "last_processed_setup": None,
            "last_exit_timestamp": None
        },
        "PE": {
            "state": "WAIT_SETUP",
            "setup_timestamp": None,
            "setup_low": None,
            "setup_high": None,
            "setup_ema": None,
            "current_stoploss": None,
            "trade_active": False,
            "option_symbol": None,
            "option_token": None,
            "atm_strike": None,
            "last_processed_setup": None,
            "last_exit_timestamp": None
        }
    }
}

market_cache_lock = threading.Lock()
_engine_started = False
_engine_lock = threading.Lock()

# Centralized Option LTP Cache and Active Set
OPTION_LTP_CACHE = {}         # token -> {"price": float, "updated_at": float}
ACTIVE_OPTION_TOKENS = {}     # token -> {"symbol": str, "last_requested": float}
option_cache_lock = threading.Lock()

OPTION_CANDLE_CACHE = {}      # token -> {"index_candle_ts": datetime, "df": DataFrame}
option_candle_cache_lock = threading.Lock()


def get_cached_option_candles(user_id: str, token: str, index_latest_ts) -> pd.DataFrame:
    with option_candle_cache_lock:
        cached = OPTION_CANDLE_CACHE.get(token)
        if cached is not None and cached.get("index_candle_ts") == index_latest_ts:
            return cached["df"]
    
    df = fetch_option_candles(user_id, token)
    if df is not None and not df.empty:
        with option_candle_cache_lock:
            OPTION_CANDLE_CACHE[token] = {
                "index_candle_ts": index_latest_ts,
                "df": df
            }
    return df


def is_strategy_three_trade_active(index_name: str, opt_type: str = None) -> bool:
    """
    Returns True if ANY Strategy Three trade or setup is active for index_name.
    Ensures:
    - Only ONE Strategy Three trade is allowed per Index.
    - If NIFTY has any active Strategy Three trade (CE or PE), ignore every new setup.
    - Do not allow simultaneous CE and PE trades for the same Index.
    """
    try:
        # 1. Check central state machine for index_name (both CE and PE)
        if index_name in STRATEGY_THREE_STATE:
            for side in ["CE", "PE"]:
                st = STRATEGY_THREE_STATE[index_name].get(side, {})
                if st.get("state") in ["WAIT_ENTRY", "TRADE_ACTIVE", "TRAIL_STOP"] or st.get("trade_active"):
                    return True

        # 2. Check all running user bots for active_trade on index_name
        import main
        with main.bot_lock:
            for u_id, bot_info in list(main.running_bots.items()):
                cfg = bot_info.get("config", {})
                if cfg.get("strategy") == "strategy_three" and cfg.get("index") == index_name:
                    active_trade = bot_info.get("active_trade")
                    if active_trade is not None:
                        return True
    except Exception as e:
        logging.error(f"Error in is_strategy_three_trade_active: {e}")
    return False


def reset_strategy_three_state(index_name: str, opt_type: str = None):
    """
    Safely resets Strategy Three state for index_name back to WAIT_SETUP while
    PRESERVING last_processed_setup to prevent duplicate setup evaluation on the same candle.
    """
    with market_cache_lock:
        if index_name in STRATEGY_THREE_STATE:
            sides = [opt_type] if opt_type in ["CE", "PE"] else ["CE", "PE"]
            for side in sides:
                st = STRATEGY_THREE_STATE[index_name][side]
                old_state = st.get("state")
                st["state"] = "WAIT_SETUP"
                st["setup_timestamp"] = None
                st["setup_low"] = None
                st["setup_high"] = None
                st["setup_ema"] = None
                st["current_stoploss"] = None
                st["trade_active"] = False
                st["option_symbol"] = None
                st["option_token"] = None
                st["atm_strike"] = None
                if old_state != "WAIT_SETUP":
                    broadcast_strategy_three_log(f"[STATE TRANSITION] {index_name} {side}: {old_state} -> WAIT_SETUP")



def start_market_data_engine():
    global _engine_started
    with _engine_lock:
        if not _engine_started:
            import session_manager
            # Start Market data loop
            t1 = threading.Thread(target=_market_data_engine_loop, daemon=True)
            t1.start()
            # Start Option LTP polling loop
            t2 = threading.Thread(target=_option_ltp_engine_loop, daemon=True)
            t2.start()
            # Start Central User Status Sync loop
            session_manager.start_user_status_sync_loop()

            _engine_started = True
            logging.info("[MARKET ENGINE] Central Market Data, Option, and User Status Engines started.")


def _option_ltp_engine_loop():
    import order_manager
    logging.info("[OPTION ENGINE] Central Option LTP Engine loop started.")
    while True:
        try:
            now = time.time()
            active_tokens = []
            with option_cache_lock:
                for tok, info in list(ACTIVE_OPTION_TOKENS.items()):
                    if now - info["last_requested"] < 10:
                        active_tokens.append((tok, info["symbol"]))
                    else:
                        ACTIVE_OPTION_TOKENS.pop(tok, None)

            if active_tokens:
                user_id = order_manager._get_any_active_user_id()
                if user_id:
                    for tok, sym in active_tokens:
                        try:
                            ltp = _fetch_option_ltp_raw(user_id, tok, sym)
                            if ltp is not None:
                                with option_cache_lock:
                                    OPTION_LTP_CACHE[tok] = {
                                        "price": float(ltp),
                                        "updated_at": time.time()
                                    }
                        except Exception as e:
                            logging.error(f"[OPTION ENGINE] Error fetching LTP for token {tok}: {e}")
                else:
                    logging.warning("[OPTION ENGINE] No active broker session found to poll options.")
        except Exception as err:
            logging.error(f"[OPTION ENGINE] Error in loop: {err}", exc_info=True)
        time.sleep(1)


def _fetch_option_ltp_raw(user_id: str, symboltoken: str, symbol: str) -> float | None:
    now_ts = int(time.time())
    from_ts = now_ts - 600  # last 10 minutes
    symbol_id = symboltoken

    url = f"{BASE_URL}/api/mkt-data/chart/interval-data"
    params = {
        "id": symbol_id,
        "interval": "1",
        "from": from_ts,
        "to": now_ts,
    }

    # Standard retry delays: 2s after 1st attempt, 5s after 2nd attempt. Max 3 attempts total.
    delays = [2, 5]
    for attempt in range(1, 4):
        try:
            _log_auth_check(user_id, "market_data")
            response = requests.get(
                url, headers=_headers(user_id), params=params, timeout=10
            )
            if response.status_code == 200:
                res = response.json()
                bars = res.get("d", {}).get("bars", [])
                if bars:
                    return float(bars[-1][4])
            elif _is_auth_error(response):
                logging.warning(f"[SESSION EXPIRED] User: {user_id} in option raw fetch")
                from session_manager import attempt_broker_auto_login
                if attempt_broker_auto_login(user_id):
                    # Retry once with fresh token
                    response = requests.get(
                        url, headers=_headers(user_id), params=params, timeout=10
                    )
                    if response.status_code == 200:
                        res = response.json()
                        bars = res.get("d", {}).get("bars", [])
                        if bars:
                            return float(bars[-1][4])
                _handle_401(user_id, url)
                break
            else:
                logging.error(f"[FETCH ERROR] Status: {response.status_code} | Token: {symbol_id}")
        except Exception as e:
            logging.error(f"[FETCH EXCEPTION] token={symbol_id} | attempt={attempt} | {e}")

        if attempt < 3:
            time.sleep(delays[attempt - 1])
    return None


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

            # Get active indices from running bots and ongoing strategy sequences
            active_indices = set()
            try:
                import main
                with main.bot_lock:
                    for u_id, bot_info in list(main.running_bots.items()):
                        cfg = bot_info.get("config", {})
                        idx = cfg.get("index")
                        if idx:
                            active_indices.add(idx.upper())
            except Exception as e:
                logging.error(f"Error checking active bot indices: {e}")

            for idx_name in ["NIFTY", "BANKNIFTY"]:
                if any(STRATEGY_THREE_STATE[idx_name][ot]["state"] != "WAIT_SETUP" for ot in ["CE", "PE"]):
                    active_indices.add(idx_name)

            if not active_indices:
                continue

            # Central fetch log
            logging.info(
                f"[YFINANCE FETCH]\n\n"
                f"Executed by:\n"
                f"Market Data Engine\n\n"
                f"Not by individual users."
            )

            ist = pytz.timezone('Asia/Kolkata')
            now = datetime.datetime.now(ist)

            # Fetch NIFTY & BANKNIFTY (active only)
            raw_dfs = {}
            for index_name, ticker in [("NIFTY", "^NSEI"), ("BANKNIFTY", "^NSEBANK")]:
                if index_name not in active_indices:
                    continue
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
                        raw_dfs[index_name] = df_5m_new.copy()
                        if now < (last_ts + datetime.timedelta(minutes=5)):
                            df_5m_new = df_5m_new.iloc[:-1]

                        if not df_5m_new.empty and current_df is not None:
                            last_global_ts = current_df['timestamp_ist'].iloc[-1]
                            new_candles = df_5m_new[df_5m_new['timestamp_ist'] > last_global_ts]
                            if not new_candles.empty:
                                k5 = 2 / (5 + 1)
                                k21 = 2 / (21 + 1)
                                for idx, row in new_candles.iterrows():
                                    last_ema5 = current_df['EMA5'].iloc[-1]
                                    new_ema5  = (row['close'] * k5) + (last_ema5 * (1 - k5))
                                    
                                    if 'EMA21' in current_df.columns:
                                        last_ema21 = current_df['EMA21'].iloc[-1]
                                        new_ema21 = (row['close'] * k21) + (last_ema21 * (1 - k21))
                                    else:
                                        new_ema21 = row['close']
                                        
                                    row = row.copy()
                                    row['EMA5'] = new_ema5
                                    row['EMA21'] = new_ema21
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
                if index_name not in active_indices:
                    continue
                with market_cache_lock:
                    df = MARKET_DATA_CACHE[index_name]
                    live_ltp = MARKET_LTP_CACHE[index_name]

                if df is None or len(df) < 5:
                    continue

                recent_df = df.tail(5)
                latest_candle = recent_df.iloc[-1]
                latest_ts = latest_candle['timestamp_ist'] if 'timestamp_ist' in latest_candle else recent_df.index[-1]

                # Strategy One
                last_t_s1 = last_candle_time[index_name]["strategy_one"]
                if latest_ts != last_t_s1:
                    is_setup_valid, s_low, s_high, s_ema, s_time = strategy_one.get_setup_levels(recent_df)
                    _update_shared_setup_and_signals(
                        index_name, "strategy_one", is_setup_valid, s_low, s_high, s_ema, s_time, live_ltp, last_candle_time, is_new_candle=True
                    )
                else:
                    _update_shared_setup_and_signals(
                        index_name, "strategy_one", None, None, None, None, latest_ts, live_ltp, last_candle_time, is_new_candle=False
                    )

                # Strategy Two
                last_t_s2 = last_candle_time[index_name]["strategy_two"]
                if latest_ts != last_t_s2:
                    is_setup_valid_s2, s_low_s2, s_high_s2, s_ema_s2, s_time_s2, candle_size = strategy_two.get_setup_levels(recent_df)
                    _update_shared_setup_and_signals(
                        index_name, "strategy_two", is_setup_valid_s2, s_low_s2, s_high_s2, s_ema_s2, s_time_s2, live_ltp, last_candle_time, is_new_candle=True, candle_size=candle_size
                    )
                else:
                    _update_shared_setup_and_signals(
                        index_name, "strategy_two", None, None, None, None, latest_ts, live_ltp, last_candle_time, is_new_candle=False
                    )

                # Strategy Three (Centralized Option EMA21 Strategy)
                is_idx_active = False
                try:
                    import main
                    with main.bot_lock:
                        for u_id, bot_info in list(main.running_bots.items()):
                            cfg = bot_info.get("config", {})
                            if cfg.get("strategy") == "strategy_three" and cfg.get("index", "").upper() == index_name:
                                is_idx_active = True
                                break
                except Exception:
                    pass

                if not is_idx_active:
                    if any(STRATEGY_THREE_STATE[index_name][ot]["state"] != "WAIT_SETUP" for ot in ["CE", "PE"]):
                        is_idx_active = True

                if is_idx_active:
                    import order_manager
                    user_id = order_manager._get_any_active_user_id()
                    if user_id and live_ltp is not None:
                        try:
                            raw_df = raw_dfs.get(index_name)
                            if raw_df is None or raw_df.empty:
                                raw_df = df
                                
                            # Global check if Index has active trade/setup (blocks both CE and PE setup evaluation)
                            index_has_active_trade = is_strategy_three_trade_active(index_name)

                            for opt_type in ["CE", "PE"]:
                                state = STRATEGY_THREE_STATE[index_name][opt_type]
                                current_state = state["state"]

                                # Enforce Trade Entry Time Window constraint: 10:00 AM IST to 3:00 PM IST
                                ist = pytz.timezone('Asia/Kolkata')
                                ist_now = datetime.datetime.now(ist)
                                in_trading_window = datetime.time(10, 0) <= ist_now.time() < datetime.time(15, 0)

                                if not in_trading_window:
                                    if current_state in ["WAIT_SETUP", "WAIT_ENTRY"]:
                                        if current_state == "WAIT_ENTRY":
                                            broadcast_strategy_three_log(f"🕒 Time limit reached (3:00 PM). Resetting {index_name} {opt_type} setup.")
                                            reset_strategy_three_state(index_name, opt_type)
                                        continue

                                if current_state == "WAIT_SETUP":
                                    # Rule: If Index has any active Strategy Three trade (CE or PE), ignore every new setup.
                                    if index_has_active_trade:
                                        continue
                                        
                                    if df is not None and not df.empty:
                                        latest_candle = df.iloc[-1]
                                        latest_ts = latest_candle['timestamp_ist']
                                        
                                        # Index-level and side-level duplicate setup protection
                                        index_last_setup = STRATEGY_THREE_STATE[index_name].get("last_processed_setup")
                                        if index_last_setup != latest_ts and state.get("last_processed_setup") != latest_ts:
                                            if 'EMA21' in latest_candle:
                                                ema21 = float(latest_candle['EMA21'])
                                                low = float(latest_candle['low'])
                                                high = float(latest_candle['high'])
                                                close = float(latest_candle['close'])
                                                
                                                setup_match = False
                                                if opt_type == "CE":
                                                    setup_match = strategy_three.check_setup_ce(low, close, ema21)
                                                    if setup_match:
                                                        state["setup_low"] = low
                                                        state["setup_high"] = None
                                                else:
                                                    setup_match = strategy_three.check_setup_pe(high, close, ema21)
                                                    if setup_match:
                                                        state["setup_low"] = None
                                                        state["setup_high"] = high
                                                        
                                                if setup_match:
                                                    # Instantly update duplicate setup protection at Index level
                                                    STRATEGY_THREE_STATE[index_name]["last_processed_setup"] = latest_ts
                                                    state["last_processed_setup"] = latest_ts
                                                    
                                                    state["state"] = "WAIT_ENTRY"
                                                    state["setup_timestamp"] = latest_ts
                                                    state["setup_ema"] = ema21
                                                    state["trade_active"] = False
                                                    state["option_symbol"] = None
                                                    state["option_token"] = None
                                                    state["atm_strike"] = None
                                                    
                                                    direction_str = "CALL" if opt_type == "CE" else "PUT"
                                                    setup_val_str = f"Setup Low : {low:.2f}" if opt_type == "CE" else f"Setup High : {high:.2f}"
                                                    
                                                    broadcast_strategy_three_log(
                                                        f"[STATE TRANSITION] {index_name} {opt_type}: WAIT_SETUP -> WAIT_ENTRY\n"
                                                        f"[SETUP]\n"
                                                        f"Index : {index_name}\n"
                                                        f"Direction : {direction_str}\n"
                                                        f"{setup_val_str}\n"
                                                        f"EMA21 : {ema21:.2f}\n"
                                                        f"Candle TS : {latest_ts.strftime('%H:%M:%S')}"
                                                    )
                                                    
                                elif current_state == "WAIT_ENTRY":
                                    setup_ts = state["setup_timestamp"]
                                    setup_ema = state["setup_ema"]
                                    
                                    expected_confirm_ts = setup_ts + datetime.timedelta(minutes=5)
                                    
                                    if df is not None and not df.empty:
                                        latest_candle = df.iloc[-1]
                                        latest_ts = latest_candle['timestamp_ist']
                                        
                                        if latest_ts == expected_confirm_ts:
                                            open_price = float(latest_candle['open'])
                                            low_price = float(latest_candle['low'])
                                            high_price = float(latest_candle['high'])
                                            ema_val = float(latest_candle['EMA21']) if 'EMA21' in latest_candle else setup_ema
                                            
                                            trigger_signal = False
                                            if opt_type == "CE":
                                                trigger_signal = strategy_three.check_confirmation_ce(open_price, low_price, ema_val)
                                            else:
                                                trigger_signal = strategy_three.check_confirmation_pe(open_price, high_price, ema_val)
                                                
                                            if trigger_signal:
                                                step = 50 if index_name == "NIFTY" else 100
                                                atm_strike = round(live_ltp / step) * step
                                                opt_tok, opt_sym, option_ltp = order_manager.select_atm_option(
                                                    user_id=user_id,
                                                    index_ltp=live_ltp,
                                                    index_name=index_name,
                                                    option_type=opt_type
                                                )
                                                
                                                if opt_tok and option_ltp is not None:
                                                    state["state"] = "TRADE_ACTIVE"
                                                    state["trade_active"] = True
                                                    state["option_symbol"] = opt_sym
                                                    state["option_token"] = opt_tok
                                                    state["atm_strike"] = atm_strike
                                                    state["signal_time"] = time.time()
                                                    
                                                    if opt_type == "CE":
                                                        state["current_stoploss"] = state["setup_low"]
                                                    else:
                                                        state["current_stoploss"] = state["setup_high"]
                                                        
                                                    with market_cache_lock:
                                                        SHARED_SIGNALS[index_name]["strategy_three"] = {
                                                            "strategy_name": "strategy_three",
                                                            "signal_type": opt_type,
                                                            "option_symbol": opt_sym,
                                                            "option_token": opt_tok,
                                                            "atm_strike": atm_strike,
                                                            "option_ltp": option_ltp,
                                                            "timestamp": time.time(),
                                                            "opt_tok": opt_tok,
                                                            "opt_sym": opt_sym,
                                                            "setup_low": state["setup_low"],
                                                            "setup_high": state["setup_high"],
                                                            "setup_ema": state["setup_ema"],
                                                            "current_stoploss": state["current_stoploss"]
                                                        }
                                                        
                                                    opt_code_str = "CE" if opt_type == "CE" else "PE"
                                                    broadcast_strategy_three_log(
                                                        f"[STATE TRANSITION] {index_name} {opt_type}: WAIT_ENTRY -> TRADE_ACTIVE\n"
                                                        f"[ENTRY]\n"
                                                        f"BUY ATM {opt_code_str}\n"
                                                        f"Strike : {atm_strike} {opt_code_str}\n"
                                                        f"Index : {index_name}\n"
                                                        f"Stop Loss : {state['current_stoploss']:.2f}"
                                                    )
                                                else:
                                                    logging.error(f"[STRATEGY THREE] Failed to resolve ATM option instrument for {index_name} {opt_type}")
                                                    reset_strategy_three_state(index_name, opt_type)
                                            else:
                                                cond_str = (
                                                    f"open ({open_price:.2f}) > EMA ({ema_val:.2f}) and low ({low_price:.2f}) > EMA ({ema_val:.2f})"
                                                    if opt_type == "CE" else
                                                    f"open ({open_price:.2f}) < EMA ({ema_val:.2f}) and high ({high_price:.2f}) < EMA ({ema_val:.2f})"
                                                )
                                                broadcast_strategy_three_log(
                                                    f"❌ Confirmation candle {latest_ts.strftime('%H:%M')} failed condition: {cond_str}. Resetting setup."
                                                )
                                                reset_strategy_three_state(index_name, opt_type)
                                                
                                        elif latest_ts > expected_confirm_ts:
                                            broadcast_strategy_three_log(
                                                f"❌ Current completed candle {latest_ts.strftime('%H:%M')} is past the expected next candle. Resetting setup."
                                            )
                                            reset_strategy_three_state(index_name, opt_type)
                                            
                                elif current_state == "TRADE_ACTIVE":
                                    is_active = is_strategy_three_trade_active(index_name)
                                    if is_active:
                                        state["state"] = "TRAIL_STOP"
                                        state["trade_active"] = True
                                        state["last_trailed_candle_ts"] = df.iloc[-1]['timestamp_ist'] if df is not None and not df.empty else None
                                        broadcast_strategy_three_log(
                                            f"[STATE TRANSITION] {index_name} {opt_type}: TRADE_ACTIVE -> TRAIL_STOP\n"
                                            f"[ENTRY TRIGGERED] | {index_name} {opt_type} (Option: {state['option_symbol']})"
                                        )
                                        
                                elif current_state == "TRAIL_STOP":
                                    if df is not None and not df.empty:
                                        latest_candle = df.iloc[-1]
                                        latest_ts = latest_candle['timestamp_ist']
                                        
                                        if latest_ts != state.get("last_trailed_candle_ts"):
                                            prev_sl = state["current_stoploss"]
                                            if opt_type == "CE":
                                                prev_low = float(latest_candle['low'])
                                                if prev_low > prev_sl:
                                                    state["current_stoploss"] = prev_low
                                                    broadcast_strategy_three_log(
                                                        f"[TRAIL]\n"
                                                        f"[TRAIL STOP UPDATED]\n"
                                                        f"Old SL : {prev_sl:.2f}\n"
                                                        f"New SL : {prev_low:.2f}\n"
                                                        f"Candle TS : {latest_ts.strftime('%H:%M')}"
                                                    )
                                            else: # PE
                                                prev_high = float(latest_candle['high'])
                                                if prev_high < prev_sl:
                                                    state["current_stoploss"] = prev_high
                                                    broadcast_strategy_three_log(
                                                        f"[TRAIL]\n"
                                                        f"[TRAIL STOP UPDATED]\n"
                                                        f"Old SL : {prev_sl:.2f}\n"
                                                        f"New SL : {prev_high:.2f}\n"
                                                        f"Candle TS : {latest_ts.strftime('%H:%M')}"
                                                    )
                                            state["last_trailed_candle_ts"] = latest_ts
                                            
                                    is_active = is_strategy_three_trade_active(index_name)
                                    if not is_active:
                                        broadcast_strategy_three_log(
                                            f"[STATE TRANSITION] {index_name} {opt_type}: TRAIL_STOP -> WAIT_SETUP\n"
                                            f"[EXIT]\n"
                                            f"Reason : Index touched trailing stop\n"
                                            f"Exit Index : {live_ltp:.2f}"
                                        )
                                        reset_strategy_three_state(index_name, opt_type)
                        except Exception as ex:
                            logging.error(f"[STRATEGY THREE ERROR] Exception: {ex}", exc_info=True)

        except Exception as err:
            logging.error(f"[MARKET ENGINE] Error in loop: {err}", exc_info=True)


def _update_shared_setup_and_signals(
    index_name: str,
    strategy: str,
    is_setup_valid: bool | None,
    s_low: float | None,
    s_high: float | None,
    s_ema: float | None,
    s_time,
    live_ltp: float | None,
    last_candle_time: dict,
    is_new_candle: bool = False,
    candle_size: float | None = None
):
    with market_cache_lock:
        if is_new_candle:
            last_candle_time[index_name][strategy] = s_time
            SHARED_SETUPS[index_name][strategy] = None
            if is_setup_valid:
                SHARED_SETUPS[index_name][strategy] = {
                    "low": s_low,
                    "high": s_high,
                    "ema": s_ema,
                    "time": s_time
                }
                if candle_size is not None:
                    SHARED_SETUPS[index_name][strategy]["candle_size"] = candle_size
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

                # ── Central Instrument Selection ───────────────────
                import order_manager
                opt_tok, opt_sym, option_ltp = None, None, None
                user_id = order_manager._get_any_active_user_id()
                if user_id:
                    opt_tok, opt_sym, option_ltp = order_manager.select_atm_option(
                        user_id=user_id,
                        index_ltp=live_ltp,
                        index_name=index_name,
                        option_type="PE"
                    )

                if opt_tok:
                    logging.info(f"[MARKET ENGINE] Central instrument selected: {opt_sym} (token={opt_tok})")
                else:
                    logging.error(f"[MARKET ENGINE] Central instrument selection FAILED for {index_name} {strategy}")

                SHARED_SIGNALS[index_name][strategy] = {
                    "symbol": index_name,
                    "direction": "PE",
                    "entry_price": live_ltp,
                    "strategy": strategy,
                    "timestamp": time.time(),
                    "setup": setup,
                    "opt_tok": opt_tok,
                    "opt_sym": opt_sym,
                    "option_ltp": option_ltp
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
        df['EMA21'] = df['close'].ewm(span=21, adjust=False).mean()
        logging.info("EMA5 and EMA21 initialized from yfinance.")
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
    Uses yfinance for indices, central option LTP cache for option contracts.
    """
    is_index = symboltoken in INDEX_YF_MAP
    
    if is_index:
        ticker = INDEX_YF_MAP[symboltoken]
        index_name = "NIFTY" if ticker == "^NSEI" else "BANKNIFTY"
        with market_cache_lock:
            return MARKET_LTP_CACHE.get(index_name)
        
    else:
        # Check central Option LTP Cache
        now = time.time()
        with option_cache_lock:
            # Register/refresh in active set so the background loop polls it
            if symboltoken not in ACTIVE_OPTION_TOKENS:
                ACTIVE_OPTION_TOKENS[symboltoken] = {
                    "symbol": symbol,
                    "last_requested": now
                }
            else:
                ACTIVE_OPTION_TOKENS[symboltoken]["last_requested"] = now

            cached = OPTION_LTP_CACHE.get(symboltoken)
            if cached is not None:
                age = now - cached["updated_at"]
                if age < 2.0:
                    # Cache hit!
                    return cached["price"]
        
        # If cache miss or stale, fetch directly and update cache (fallback)
        ltp = _fetch_option_ltp_raw(user_id, symboltoken, symbol)
        if ltp is not None:
            with option_cache_lock:
                OPTION_LTP_CACHE[symboltoken] = {
                    "price": float(ltp),
                    "updated_at": time.time()
                }
            return float(ltp)
        return None


# ── Strategy Three helpers ────────────────────────────────────

def fetch_option_candles(user_id: str, symboltoken: str, interval: str = "5") -> pd.DataFrame:
    now_ts = int(time.time())
    # 2 days of history to seed EMA21 correctly
    from_ts = now_ts - 172800 

    url = f"{BASE_URL}/api/mkt-data/chart/interval-data"
    params = {
        "id": symboltoken,
        "interval": interval,
        "from": from_ts,
        "to": now_ts
    }
    
    delays = [2, 5]
    for attempt in range(1, 4):
        try:
            _log_auth_check(user_id, "market_data")
            response = requests.get(url, headers=_headers(user_id), params=params, timeout=10)
            if response.status_code == 200:
                data = response.json()
                if not data or data.get("s") == "no-data":
                    return pd.DataFrame()
                res_d = data.get("d", {})
                bars = res_d.get("bars", [])
                if not bars:
                    return pd.DataFrame()
                
                df = pd.DataFrame(bars, columns=['time', 'open', 'high', 'low', 'close', 'volume', 'oi'])
                df['timestamp_ist'] = pd.to_datetime(df['time'], unit='ms').dt.tz_localize('UTC').dt.tz_convert('Asia/Kolkata')
                df.set_index('timestamp_ist', inplace=True, drop=False)
                df = df[['timestamp_ist', 'open', 'high', 'low', 'close', 'volume']]
                return df
            elif _is_auth_error(response):
                logging.warning(f"[SESSION EXPIRED] User: {user_id} in option candle fetch")
                from session_manager import attempt_broker_auto_login
                if attempt_broker_auto_login(user_id):
                    # Retry once with fresh token
                    response = requests.get(url, headers=_headers(user_id), params=params, timeout=10)
                    if response.status_code == 200:
                        data = response.json()
                        if not data or data.get("s") == "no-data":
                            return pd.DataFrame()
                        res_d = data.get("d", {})
                        bars = res_d.get("bars", [])
                        if not bars:
                            return pd.DataFrame()
                        df = pd.DataFrame(bars, columns=['time', 'open', 'high', 'low', 'close', 'volume', 'oi'])
                        df['timestamp_ist'] = pd.to_datetime(df['time'], unit='ms').dt.tz_localize('UTC').dt.tz_convert('Asia/Kolkata')
                        df.set_index('timestamp_ist', inplace=True, drop=False)
                        df = df[['timestamp_ist', 'open', 'high', 'low', 'close', 'volume']]
                        return df
                _handle_401(user_id, url)
                break
        except Exception as e:
            logging.error(f"[OPTION CANDLES EXCEPTION] token={symboltoken} | attempt={attempt} | {e}")
        
        if attempt < 3:
            time.sleep(delays[attempt - 1])
            
    return pd.DataFrame()


def get_option_token_symbol(index_name: str, atm_strike: int, opt_type: str) -> tuple:
    import order_manager
    key = f"{index_name.upper()}_{int(atm_strike)}_{opt_type.upper()}"
    with order_manager.instrument_map_lock:
        entry = order_manager.instrument_map.get(key)
    if entry is None:
        step = 50 if index_name.upper() == "NIFTY" else 100
        fallback_key = order_manager._find_closest_strike(index_name.upper(), int(atm_strike), step, opt_type.upper())
        if fallback_key:
            with order_manager.instrument_map_lock:
                entry = order_manager.instrument_map.get(fallback_key)
    if entry:
        return entry["token"], entry["symbol"]
    return None, None


def broadcast_strategy_three_log(message: str) -> None:
    logging.info(f"[STRATEGY THREE] {message}")
    try:
        import main
        with main.bot_lock:
            for u_id, bot_info in list(main.running_bots.items()):
                cfg = bot_info.get("config", {})
                if cfg.get("strategy") == "strategy_three":
                    main.add_log(u_id, message)
    except Exception:
        pass

