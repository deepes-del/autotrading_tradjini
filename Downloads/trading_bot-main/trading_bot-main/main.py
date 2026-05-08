"""
main.py  –  Multi-user bot orchestrator (Tradejini / CubePlus)

Each call to start_bot() launches an independent daemon thread for that user.
The bot fetches the user's Tradejini access_token from session_manager and
passes it into every data_fetcher / order_manager call via a lightweight
'broker_ctx' dict — no global credentials anywhere.
"""

import time
import logging
import datetime
import threading
import pytz
import config
import data_fetcher
import strategy
import order_manager
from session_manager import get_session, set_active, get_setup, set_setup, clear_setup
from error_logger import log_error

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(message)s')

# ── Shared state ─────────────────────────────────────────────
running_bots: dict = {}   # user_id -> {"thread": Thread, "config": dict}
bot_lock = threading.Lock()
user_logs: dict = {}       # user_id -> [str, ...]


# ── Logging helpers ──────────────────────────────────────────

def safe_log(message: str) -> str:
    blocked = ["password", "api_key", "totp", "access_token"]
    for word in blocked:
        if word in message.lower():
            return "[SENSITIVE DATA HIDDEN]"
    return message


def add_log(user_id: str, message: str) -> None:
    if not user_id:
        return
    # Sanitise before storing — never persist sensitive data in user_logs
    message = safe_log(message)
    if user_id not in user_logs:
        user_logs[user_id] = []
    if len(user_logs[user_id]) > 200:
        user_logs[user_id].pop(0)
    user_logs[user_id].append(message)
    print(f"[LOG][{user_id}] {message}")


# ── Trade persistence helpers ────────────────────────────────

def store_strategy_trade(
    user_id: str,
    symbol: str,
    qty: int,
    entry_price: float,
    sl: float,
    target: float,
    side: str = "BUY",
) -> str | None:
    """
    Insert a strategy signal into Supabase.
    Returns the generated strategy_trade_id or None on failure.
    """
    try:
        from supabase_client import supabase
        res = supabase.table("strategy_trades").insert({
            "user_id":     user_id,
            "symbol":      symbol,
            "side":        side,
            "qty":         qty,
            "entry_price": round(float(entry_price), 2),
            "sl":          round(float(sl), 2),
            "target":      round(float(target), 2),
        }).execute()
        logging.info(f"[STRATEGY STORED] user={user_id} sym={symbol}")
        if res.data and len(res.data) > 0:
            return res.data[0]["id"]
    except Exception as exc:
        logging.error(f"[STRATEGY STORE FAIL] user={user_id}: {exc}")
        log_error(user_id, "STRATEGY_STORE_FAILED", str(exc), severity="ERROR")
    return None


def store_broker_trade(
    user_id: str,
    strategy_trade_id: str | None,
    symbol: str,
    qty: int,
    executed_price: float,
    sl: float,
    target: float,
    broker_order_id: str,
    side: str = "BUY",
) -> None:
    """
    Insert a confirmed (broker-acknowledged and executed) trade into Supabase.
    Called ONLY after place_buy_order() returns success AND order status is COMPLETE.
    """
    try:
        from supabase_client import supabase
        supabase.table("broker_trades").insert({
            "user_id":           user_id,
            "strategy_trade_id": strategy_trade_id,
            "symbol":            symbol,
            "side":              side,
            "qty":               qty,
            "executed_price":    round(float(executed_price), 2),
            "sl":                round(float(sl), 2),
            "target":            round(float(target), 2),
            "status":            "OPEN",
            "broker_order_id":   broker_order_id,
        }).execute()
        logging.info(f"[BROKER TRADE STORED] user={user_id} sym={symbol} order={broker_order_id}")
    except Exception as exc:
        logging.error(f"[BROKER TRADE STORE FAIL] user={user_id}: {exc}")
        log_error(user_id, "BROKER_TRADE_STORE_FAILED", str(exc), severity="ERROR")


def close_broker_trade(
    user_id: str,
    exit_price: float,
    reason: str = "CLOSED",
) -> None:
    """
    Mark a trade CLOSED in Supabase with the exit price and timestamp.
    """
    try:
        from supabase_client import supabase
        supabase.table("broker_trades").update({
            "exit_price": round(float(exit_price), 2),
            "status":     "CLOSED",
            "closed_at":  datetime.datetime.utcnow().isoformat(),
        }).eq("user_id", user_id).eq("status", "OPEN").execute()
        logging.info(
            f"[BROKER TRADE CLOSED] user={user_id} "
            f"exit={exit_price} reason={reason}"
        )
    except Exception as exc:
        logging.error(f"[BROKER TRADE CLOSE FAIL] user={user_id}: {exc}")
        log_error(user_id, "BROKER_TRADE_CLOSE_FAILED", str(exc), severity="ERROR")


# ── Public API ───────────────────────────────────────────────

def start_bot(user_id: str, user_config: dict) -> bool:
    """
    Launch an independent bot thread for user_id.
    Returns False if a bot is already running for that user.
    """
    print(f"[START] Bot triggered for user: {user_id}")
    with bot_lock:
        if user_id in running_bots:
            print(f"[BLOCKED] Bot already running for {user_id}")
            return False

        user_logs[user_id] = []
        user_config["is_running"] = True
        user_config["stop_requested"] = False

        thread = threading.Thread(
            target=_run_bot_wrapper, args=(user_config,), daemon=True
        )
        thread.start()

        running_bots[user_id] = {"thread": thread, "config": user_config}
    return True


# ── Internal bot runner ──────────────────────────────────────

def _run_bot_wrapper(user_config: dict) -> None:
    """Top-level wrapper: ensures cleanup even on crash."""
    try:
        _run_bot_logic(user_config)
    except Exception as e:
        logging.error(f"[BOT] Execution crashed: {e}")
    finally:
        user_id = user_config.get("user_id")
        with bot_lock:
            running_bots.pop(user_id, None)
        set_active(user_id, False)
        try:
            from supabase_client import supabase
            supabase.table("users").update({"bot_running": False}).eq("user_id", user_id).execute()
        except Exception as db_e:
            logging.error(f"[BOT] DB update failed on exit: {db_e}")
        print(f"[BOT] Thread exited for user: {user_id}")


def _run_bot_logic(user_config: dict) -> None:
    user_id     = user_config.get("user_id")
    user_index  = user_config.get("index", "NIFTY")
    user_lots   = int(user_config.get("lots", 1))
    trade_qty   = user_lots * (30 if user_index == "BANKNIFTY" else 65)


    symbol_token = "99926009" if user_index == "BANKNIFTY" else "99926000"

    print(f"[RUNNING] Bot active for user: {user_id} | index: {user_index} | lots: {user_lots}")
    logging.info(f"Initiating {user_index} Real-Time Breakout Bot for user {user_id}...")

    # ── Fetch broker session ──────────────────────────────────
    add_log(user_id, "Fetching broker session...")
    session = get_session(user_id)
    if not session or not session.get("access_token"):
        add_log(user_id, "ERROR: No broker session found. Connect broker first.")
        return

    access_token = session["access_token"]
    broker_ctx = {
        "access_token": access_token,
        "client_id": session["client_id"],
    }

    # ── Load instruments ──────────────────────────────────────
    inst_df = order_manager.get_instrument_list(broker_ctx)
    if inst_df.empty:
        add_log(user_id, "ERROR: Failed to load instruments.")
        return

    # ── Initialise EMA via yfinance ───────────────────────────
    add_log(user_id, "Initialising EMA from yfinance...")
    global_df = data_fetcher.initialize_hybrid_ema(user_index)
    if global_df is None:
        add_log(user_id, "ERROR: Failed to initialize EMA framework.")
        return

    add_log(user_id, f"[BOT] Started for user {user_id}")
    add_log(user_id, "[BOT] Waiting for market conditions...")

    trades_today         = 0
    active_trade         = None
    last_log_time        = 0
    last_candle_time     = None
    eod_squared_off      = False   # Prevents duplicate EOD exits
    last_db_check        = 0       # Epoch time of last Supabase safety check

    EOD_SQUAREOFF_TIME = datetime.time(15, 15)  # 3:15 PM IST

    EXCHANGE = "NSE"

    while True:
        # ── Stop check (user-initiated) ──────────────────────────────────
        if user_config.get("stop_requested"):
            add_log(user_id, "Bot stopped by user request.")
            break

        # ── Supabase safety check (every 30s) ────────────────────────────
        # Admin may have blocked/deleted the user or set bot_running=False.
        # We poll the DB periodically so the bot self-terminates promptly.
        if time.time() - last_db_check > 30:
            last_db_check = time.time()
            try:
                from supabase_client import supabase as _sb
                db_res = _sb.table("users").select("status, bot_running").eq("user_id", user_id).execute()
                if not db_res.data:
                    add_log(user_id, "🚫 User not found in DB — bot terminating.")
                    logging.warning(f"[BOT SAFETY] User {user_id} missing from DB. Stopping.")
                    break
                row = db_res.data[0]
                if row.get("status") == "blocked":
                    add_log(user_id, "🚫 Account blocked by admin — bot terminating.")
                    logging.warning(f"[BOT SAFETY] User {user_id} is blocked. Stopping.")
                    break
                if not row.get("bot_running", True):
                    add_log(user_id, "⏹️ bot_running=False detected in DB — stopping.")
                    logging.info(f"[BOT SAFETY] bot_running=False for {user_id}. Stopping.")
                    break
            except Exception as _db_exc:
                logging.warning(f"[BOT SAFETY] DB check failed (non-fatal): {_db_exc}")
                # Non-fatal — bot continues; next iteration will retry

        ist_now      = datetime.datetime.now(config.TIMEZONE)
        market_start = ist_now.replace(hour=9,  minute=15, second=0, microsecond=0)
        market_end   = ist_now.replace(hour=15, minute=30, second=0, microsecond=0)

        if ist_now < market_start or ist_now > market_end:
            if ist_now > market_end:
                add_log(user_id, "Market closed. Waiting for next session...")
                time.sleep(60)
                continue
            # Reset EOD flag at the start of a new trading day
            if ist_now < market_start:
                eod_squared_off = False
            time.sleep(30)
            continue

        # ── EOD Square-off at 3:15 PM IST ────────────────────
        if ist_now.time() >= EOD_SQUAREOFF_TIME and not eod_squared_off:
            eod_squared_off = True  # Set immediately to prevent re-entry
            if active_trade is not None:
                add_log(user_id, "⏰ 3:15 PM reached — Auto square-off executing...")
                logging.info(f"[EOD] Square-off triggered for user {user_id}")

                # Cancel any pending SL order first
                if active_trade.get("sl_order_id") and active_trade["sl_order_id"] != "UNKNOWN":
                    order_manager.cancel_order(broker_ctx, active_trade["sl_order_id"])
                    logging.info(f"[EOD] SL order {active_trade['sl_order_id']} cancelled.")

                # Retry SELL — place_sell_order now handles retries internally
                sell_res = order_manager.place_sell_order(
                    broker_ctx, active_trade["opt_tok"],
                    active_trade["opt_sym"], active_trade["trade_qty"]
                )
                if sell_res.get("success"):
                    add_log(user_id, f"✅ EOD SELL executed | Order ID: {sell_res['order_id']}")
                    add_log(user_id, "📌 Trade closed (EOD Square-off)")
                    logging.info(f"[EOD] SELL confirmed | Order: {sell_res['order_id']}")
                    # ── Close trade in Supabase ───────────────
                    current_ltp = data_fetcher.get_ltp(
                        broker_ctx, "NFO",
                        active_trade["opt_sym"], active_trade["opt_tok"]
                    )
                    eod_exit_price = float(current_ltp) if current_ltp else active_trade["entry_price"]
                    close_broker_trade(
                        user_id,
                        eod_exit_price,
                        reason="EOD_SQUAREOFF",
                    )
                else:
                    add_log(user_id, f"❌ EOD square-off FAILED — MANUAL ACTION REQUIRED! | Reason: {sell_res.get('message')}")
                    logging.error(f"[EOD CRITICAL] Could not exit position for user {user_id}! msg={sell_res.get('message')}")
                    log_error(
                        user_id, "EOD_SQUAREOFF_FAILED",
                        sell_res.get("message", "Unknown"),
                        raw=sell_res.get("raw"),
                        severity="CRITICAL",
                    )

                active_trade = None
                clear_setup(user_id)
            else:
                add_log(user_id, "⏰ 3:15 PM — No open position. EOD check done.")

        if trades_today >= config.MAX_TRADES_PER_DAY:
            add_log(user_id, f"Max trades ({config.MAX_TRADES_PER_DAY}) reached for today.")
            break

        # ── Update Candle Data (Every 5 mins or on loop) ──────
        # We check for new candle fetch every few seconds, but the fetcher handles caching.
        fetch_success, updated_df = data_fetcher.update_hybrid_ema(
            global_df, broker_ctx, EXCHANGE, symbol_token
        )
        if fetch_success and updated_df is not None:
            global_df = updated_df

        # ── Strategy Evaluation (Latest CLOSED candle) ────────
        recent_df = global_df.tail(5)
        is_setup_valid, s_low, s_high, s_ema, s_time = strategy.get_setup_levels(recent_df)
        
        # Logging Candle Info (Only on new candle)
        if s_time != last_candle_time:
            last_candle_time = s_time
            latest = global_df.iloc[-1]
            t_str = s_time.strftime('%H:%M')
            add_log(user_id, f"📊 Candle ({t_str})\nOpen : {latest['open']:.2f}\nHigh : {latest['high']:.2f}\nLow  : {latest['low']:.2f}\nClose: {latest['close']:.2f}")
            add_log(user_id, f"📉 EMA5: {latest['EMA5']:.2f}")
            
            # 1. Check if there was an active setup before clearing
            had_old_setup = get_setup(user_id) is not None
            
            # 2. RESET SETUP ON NEW CANDLE
            # ALL previous setups must be discarded
            clear_setup(user_id)
            
            # 3. RE-EVALUATE SETUP
            if is_setup_valid:
                # Store new setup
                set_setup(user_id, {"low": s_low, "high": s_high, "ema": s_ema, "time": s_time})
                add_log(user_id, f"🧠 Setup detected\nLow above EMA → Bullish strength\nWaiting for breakdown below {s_low:.2f}")
            else:
                # 5. LOGGING FIX
                if had_old_setup:
                    add_log(user_id, "❌ Previous setup invalidated")
                else:
                    add_log(user_id, "❌ No setup — candle not above EMA")
                
                add_log(user_id, "⏳ Waiting for next candle...")

        # 4. Fetch the strictly validated setup for the current loop
        setup = get_setup(user_id)

        # ── Expire stale setup (30 mins) ──────────────────────
        if setup:
            # Ensure setup['time'] is compared correctly
            s_time_dt = setup['time']
            if isinstance(s_time_dt, str): # Handle potential string from index
                 pass # Should be datetime if using recent_df.name or timestamp_ist
            
            time_diff = (ist_now.replace(tzinfo=None) - s_time_dt.replace(tzinfo=None)).total_seconds()
            if time_diff > 1800: # 30 minutes
                add_log(user_id, "⏳ Setup expired (30 mins). Clearing.")
                clear_setup(user_id)
                setup = None

        # ── Open trade monitoring (INDEX-BASED) ────────────────
        if active_trade is not None:
            # We track the INDEX for SL/Target
            current_index_ltp_raw = data_fetcher.get_ltp(
                broker_ctx, EXCHANGE, user_index, symbol_token
            )
            if current_index_ltp_raw is not None:
                current_index_ltp = float(current_index_ltp_raw)

                # For a PUT, target is hit when index drops below target_price
                if current_index_ltp <= active_trade["index_target"]:
                    tgt_res = order_manager.place_sell_order(
                        broker_ctx, active_trade["opt_tok"],
                        active_trade["opt_sym"], active_trade["trade_qty"]
                    )
                    if tgt_res.get("success"):
                        # Get option exit price
                        current_opt_ltp_raw = data_fetcher.get_ltp(
                            broker_ctx, "NFO", active_trade["opt_sym"], active_trade["opt_tok"]
                        )
                        current_opt_ltp = float(current_opt_ltp_raw) if current_opt_ltp_raw else active_trade["entry_price"]
                        
                        add_log(user_id, f"🎯 INDEX Target Hit ({current_index_ltp})! SELL confirmed at {current_opt_ltp} | Order: {tgt_res['order_id']}")
                        close_broker_trade(
                            user_id,
                            current_opt_ltp,
                            reason="TARGET_HIT",
                        )
                    else:
                        add_log(user_id, f"⚠️ Target reached but SELL failed: {tgt_res.get('message')} — MANUAL EXIT NEEDED")
                        logging.error(f"[TARGET SELL FAIL] user={user_id} msg={tgt_res.get('message')}")
                        log_error(user_id, "TARGET_SELL_FAILED", tgt_res.get("message", "Unknown"), raw=tgt_res.get("raw"), severity="ERROR")
                    
                    active_trade = None
                    continue

                # For a PUT, SL is hit when index rises above sl_price
                if current_index_ltp >= active_trade["index_sl"]:
                    sl_res = order_manager.place_sell_order(
                        broker_ctx, active_trade["opt_tok"],
                        active_trade["opt_sym"], active_trade["trade_qty"]
                    )
                    if sl_res.get("success"):
                        current_opt_ltp_raw = data_fetcher.get_ltp(
                            broker_ctx, "NFO", active_trade["opt_sym"], active_trade["opt_tok"]
                        )
                        current_opt_ltp = float(current_opt_ltp_raw) if current_opt_ltp_raw else active_trade["entry_price"]
                        
                        add_log(user_id, f"🛑 INDEX Stoploss Hit ({current_index_ltp})! SELL confirmed at {current_opt_ltp}")
                        close_broker_trade(
                            user_id,
                            current_opt_ltp,
                            reason="SL_HIT",
                        )
                    else:
                        add_log(user_id, f"⚠️ SL reached but SELL failed: {sl_res.get('message')} — MANUAL EXIT NEEDED")
                        logging.error(f"[SL SELL FAIL] user={user_id} msg={sl_res.get('message')}")
                        log_error(user_id, "SL_SELL_FAILED", sl_res.get("message", "Unknown"), raw=sl_res.get("raw"), severity="ERROR")
                        
                    active_trade = None
                    continue

            time.sleep(1)
            continue

        # ── Entry phase ───────────────────────────────────────
        if setup and active_trade is None:
            # Periodic "Monitoring" log (every 60s)
            if time.time() - last_log_time > 60:
                add_log(user_id, f"🧠 Active Setup:\nWatching breakdown below {setup['low']:.2f}")
                add_log(user_id, "⏳ Monitoring price...")
                last_log_time = time.time()

            index_ltp_raw = data_fetcher.get_ltp(
                broker_ctx, EXCHANGE, user_index, symbol_token
            )

            if index_ltp_raw is not None:
                index_ltp = float(index_ltp_raw)

                if index_ltp < setup['low']:
                    add_log(user_id, f"🔥 Breakdown triggered at {index_ltp:.2f}")
                    
                    # 1. Calculate candle_range
                    candle_range = setup['high'] - setup['low']

                    if candle_range <= 0:
                        add_log(user_id, "⚠️ Warning: invalid candle range. Skipping.")
                        clear_setup(user_id)
                    else:
                        # 2. Compute sl_points = min(candle_range, 20)
                        sl_points = min(candle_range, 20)
                        
                        # 3. Compute target_points = 2 * sl_points
                        target_points = 2 * sl_points

                        # 7. Price Levels (for PUT / breakdown)
                        entry_price = setup['low']
                        sl_price = entry_price + sl_points
                        target_price = entry_price - target_points

                        # 9. Logging
                        add_log(user_id, f"📊 Execution Parameters:\ncandle_range: {candle_range:.2f}\nsl_points: {sl_points:.2f}\ntarget_points: {target_points:.2f}\nentry_price: {entry_price:.2f}\nsl_price: {sl_price:.2f}\ntarget_price: {target_price:.2f}")

                        opt_tok, opt_sym, option_ltp = order_manager.select_atm_option(
                            broker_ctx, inst_df, index_ltp, user_index
                        )

                        if opt_tok and option_ltp:
                            # ── 1. Store Strategy Signal ──────────────────
                            strat_id = store_strategy_trade(
                                user_id=user_id,
                                symbol=opt_sym,
                                qty=trade_qty,
                                entry_price=entry_price, # Store index entry
                                sl=sl_price,             # Store index SL
                                target=target_price,     # Store index Target
                            )

                            # ── 2. Place BUY and validate strictly ──────────────
                            buy_res = order_manager.place_buy_order(
                                broker_ctx, opt_tok, opt_sym, trade_qty
                            )

                            if buy_res.get("success"):
                                buy_order_id = buy_res["order_id"]

                                # ── 3. Verify Order Status with Broker ──────────────
                                order_details = order_manager.get_order_status(broker_ctx, buy_order_id)
                                order_status = str(order_details.get("status", "")).lower() if order_details else "unknown"

                                if order_status in ["complete", "completed", "executed"]:
                                    executed_price = float(order_details.get("avgPrice") or order_details.get("price") or option_ltp)
                                    add_log(user_id, f"✅ BUY executed at {executed_price:.2f} | Order: {buy_order_id}")
                                    add_log(user_id, f"💰 Real Trade Stored\nSymbol: {opt_sym}\nOption Entry: {executed_price}")

                                    # ── 4. Store Real Broker Execution ──────────────
                                    store_broker_trade(
                                        user_id=user_id,
                                        strategy_trade_id=strat_id,
                                        symbol=opt_sym,
                                        qty=trade_qty,
                                        executed_price=executed_price,
                                        sl=sl_price,
                                        target=target_price,
                                        broker_order_id=buy_order_id,
                                    )

                                    # Virtual SL applied. No broker SL order needed!
                                    # Mark trade active ONLY after confirmed BUY execution
                                    active_trade = {
                                        "opt_tok":      opt_tok,
                                        "opt_sym":      opt_sym,
                                        "trade_qty":    trade_qty,
                                        "entry_price":  executed_price, # Option price
                                        "index_entry":  entry_price,
                                        "index_sl":     sl_price,
                                        "index_target": target_price,
                                        "buy_order_id": buy_order_id,
                                    }
                                    trades_today += 1
                                    clear_setup(user_id)
                                else:
                                    # Broker rejected order or it wasn't filled
                                    msg = f"Order {buy_order_id} not executed. Status: {order_status}"
                                    add_log(user_id, f"❌ {msg}")
                                    logging.error(f"[BUY FAILED EXECUTION] user={user_id} | {msg}")
                                    log_error(user_id, "ORDER_NOT_FILLED", msg, raw=order_details, severity="ERROR")
                                    clear_setup(user_id)
                            else:
                                # BUY failed — do NOT mark trade as active
                                add_log(user_id, f"❌ BUY order failed: {buy_res.get('message')}")
                                logging.error(f"[BUY FAIL] user={user_id} | msg={buy_res.get('message')} | raw={buy_res.get('raw')}")
                                log_error(
                                    user_id, "ORDER_FAILED",
                                    buy_res.get("message", "Unknown broker error"),
                                    raw=buy_res.get("raw"),
                                    severity="ERROR",
                                )
                                clear_setup(user_id)
                        else:
                            add_log(user_id, "❌ Failed to fetch option data")
                            clear_setup(user_id)

        time.sleep(1)

