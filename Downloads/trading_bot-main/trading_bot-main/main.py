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
import strategy_one
import strategy_two
import order_manager
from session_manager import (
    get_user_session,
    has_session,
    set_setup,
    get_setup,
    clear_setup
)
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
        try:
            from supabase_client import supabase
            supabase.table("users").update({"bot_running": False}).eq("user_id", user_id).execute()
        except Exception as db_e:
            logging.error(f"[BOT] DB update failed on exit: {db_e}")
        print(f"[BOT] Thread exited for user: {user_id}")


def _run_bot_logic(user_config: dict) -> None:
    user_id     = user_config.get("user_id")
    user_index  = user_config.get("index", "NIFTY")
    user_strategy = user_config.get("strategy", "strategy_one")
    user_mode   = user_config.get("mode", "default")
    user_sl     = int(user_config.get("sl", 10))
    user_target = int(user_config.get("target", 20))
    user_lots   = int(user_config.get("lots", 1))
    trade_qty   = user_lots * (30 if user_index == "BANKNIFTY" else 65)

    symbol_token = "99926009" if user_index == "BANKNIFTY" else "99926000"

    strat_display_name = "Strategy One" if user_strategy == "strategy_one" else "Strategy Two"
    print(f"[RUNNING] Bot active for user: {user_id} | index: {user_index} | strat: {strat_display_name} | lots: {user_lots}")
    logging.info(f"Initiating {user_index} {strat_display_name} Bot for user {user_id}...")

    # ── Fetch broker session ──────────────────────────────────
    add_log(user_id, "Fetching broker session...")
    from session_manager import build_broker_ctx
    broker_ctx = build_broker_ctx(user_id)
    if not broker_ctx:
        add_log(user_id, "ERROR: No active broker session found. Please reconnect broker.")
        return

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

    EOD_SQUAREOFF_TIME = datetime.time(15, 10)  # 3:10 PM IST

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

        # ── EOD Square-off at 3:10 PM IST ────────────────────
        if ist_now.time() >= EOD_SQUAREOFF_TIME and not eod_squared_off:
            eod_squared_off = True  # Set immediately to prevent re-entry
            if active_trade is not None:
                add_log(user_id, "⏰ 3:10 PM Auto Exit Triggered")
                add_log(user_id, "📤 Closing open position at market price")
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
                        reason="AUTO_310_EXIT",
                    )
                    add_log(user_id, "✅ Trade forcefully squared off")
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
                add_log(user_id, "⏰ 3:10 PM — No open position. EOD check done.")

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
        
        candle_size = None
        if user_strategy == "strategy_two":
            is_setup_valid, s_low, s_high, s_ema, s_time, candle_size = strategy_two.get_setup_levels(recent_df)
        else:
            is_setup_valid, s_low, s_high, s_ema, s_time = strategy_one.get_setup_levels(recent_df)
        
        # Logging Candle Info (Only on new candle)
        if s_time != last_candle_time:
            last_candle_time = s_time
            latest = global_df.iloc[-1]
            t_str = s_time.strftime('%H:%M')
            
            # Re-evaluate previous setups to handle invalidation properly
            had_old_setup = get_setup(user_id) is not None
            if had_old_setup:
                add_log(user_id, f"♻️ Previous setup invalidated — new candle formed")
                
            clear_setup(user_id)
            
            add_log(user_id, f"[{strat_display_name.upper()}]\n📊 Candle ({t_str})\nOpen : {latest['open']:.2f}\nHigh : {latest['high']:.2f}\nLow  : {latest['low']:.2f}\nClose: {latest['close']:.2f}")
            if user_strategy == "strategy_two" and candle_size is not None:
                add_log(user_id, f"📊 Candle Size: {candle_size:.2f} points")
                
            add_log(user_id, f"📉 EMA5: {latest['EMA5']:.2f}")

            if is_setup_valid:
                if user_strategy == "strategy_two":
                    add_log(user_id, f"✅ Small candle valid\n🧠 Setup detected\nWaiting for breakdown below {s_low:.2f}")
                else:
                    add_log(user_id, f"🧠 Setup detected\nLow above EMA → Bullish strength\nWaiting for breakdown below {s_low:.2f}")
                set_setup(user_id, {"low": s_low, "high": s_high, "ema": s_ema, "time": s_time})
            else:
                if user_strategy == "strategy_two" and candle_size is not None and candle_size > 25:
                    add_log(user_id, f"❌ Candle rejected — size {candle_size:.2f} > 25")
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
                 pass 
            
            time_diff = (ist_now.replace(tzinfo=None) - s_time_dt.replace(tzinfo=None)).total_seconds()
            if time_diff > 1800: # 30 minutes
                add_log(user_id, "⏳ Setup expired (30 mins). Clearing.")
                clear_setup(user_id)
                setup = None

        # ── Open trade monitoring (PREMIUM-BASED) ───────────────
        if active_trade is not None:
            # 1. Track the option premium price
            current_opt_ltp_raw = data_fetcher.get_ltp(
                broker_ctx, "NFO", active_trade["opt_sym"], active_trade["opt_tok"]
            )
            if current_opt_ltp_raw is not None:
                current_opt_ltp = float(current_opt_ltp_raw)

                # 2. Check if Target is hit (Profit Booking)
                if current_opt_ltp >= active_trade["option_target"]:
                    add_log(user_id, f"🎯 Target level reached ({current_opt_ltp:.2f}). Cancelling broker SL order...")
                    
                    sl_order_id = active_trade.get("sl_order_id")
                    if sl_order_id and sl_order_id != "UNKNOWN":
                        cancel_ok = order_manager.cancel_order(broker_ctx, sl_order_id)
                        if cancel_ok:
                            add_log(user_id, "✅ Broker SL order cancelled successfully.")
                        else:
                            add_log(user_id, "⚠️ SL order cancel failed (it might have already been filled).")

                    # Place the profit booking (market sell) order
                    tgt_res = order_manager.place_sell_order(
                        broker_ctx, active_trade["opt_tok"],
                        active_trade["opt_sym"], active_trade["trade_qty"]
                    )
                    if tgt_res.get("success"):
                        add_log(user_id, f"🎯 PREMIUM Target Hit ({current_opt_ltp})! SELL confirmed | Order: {tgt_res['order_id']}")
                        close_broker_trade(user_id, current_opt_ltp, reason="TARGET_HIT")
                    else:
                        add_log(user_id, f"⚠️ Target reached but SELL failed: {tgt_res.get('message')} — MANUAL EXIT NEEDED")
                        logging.error(f"[TARGET SELL FAIL] user={user_id} msg={tgt_res.get('message')}")
                        log_error(user_id, "TARGET_SELL_FAILED", tgt_res.get("message", "Unknown"), raw=tgt_res.get("raw"), severity="ERROR")
                    
                    active_trade = None
                    continue

                # 3. Check if broker-side SL is hit/filled or needs backup execution
                sl_order_id = active_trade.get("sl_order_id")
                sl_hit_detected = False
                sl_fill_price = None

                if sl_order_id and sl_order_id != "UNKNOWN":
                    # Check status of the active SL order at the broker
                    sl_order_details = order_manager.get_order_status(broker_ctx, sl_order_id)
                    if sl_order_details:
                        status = str(sl_order_details.get("status", "")).lower()
                        
                        if status in ["complete", "completed", "executed"]:
                            sl_fill_price = float(sl_order_details.get("avgPrice") or sl_order_details.get("price") or active_trade["option_sl"])
                            add_log(user_id, f"🛑 Broker Stoploss filled at ₹{sl_fill_price:.2f}!")
                            sl_hit_detected = True
                        elif status in ["rejected", "cancelled", "canceled"]:
                            # Emergency backup: SL order was rejected or cancelled, but price has crossed the threshold!
                            if current_opt_ltp <= active_trade["option_sl"]:
                                add_log(user_id, f"⚠️ Broker SL order was {status.upper()}! Placing emergency market exit at ₹{current_opt_ltp:.2f}...")
                                sl_res = order_manager.place_sell_order(
                                    broker_ctx, active_trade["opt_tok"],
                                    active_trade["opt_sym"], active_trade["trade_qty"]
                                )
                                if sl_res.get("success"):
                                    sl_fill_price = current_opt_ltp
                                    sl_hit_detected = True
                                else:
                                    add_log(user_id, f"🚨 Emergency market exit FAILED: {sl_res.get('message')} — MANUAL ACTION NEEDED!")
                else:
                    # SL order ID is UNKNOWN (fallback bot-side monitoring)
                    if current_opt_ltp <= active_trade["option_sl"]:
                        add_log(user_id, f"🛑 Option price dropped to ₹{current_opt_ltp:.2f} (SL: ₹{active_trade['option_sl']:.2f}). Placing market sell...")
                        sl_res = order_manager.place_sell_order(
                            broker_ctx, active_trade["opt_tok"],
                            active_trade["opt_sym"], active_trade["trade_qty"]
                        )
                        if sl_res.get("success"):
                            sl_fill_price = current_opt_ltp
                            sl_hit_detected = True
                        else:
                            add_log(user_id, f"⚠️ Backup SL market exit FAILED: {sl_res.get('message')} — MANUAL ACTION NEEDED!")

                if sl_hit_detected:
                    exit_val = sl_fill_price if sl_fill_price else active_trade["option_sl"]
                    close_broker_trade(user_id, exit_val, reason="SL_HIT")
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
                        entry_price = setup['low']
                        
                        # SL/Target calculation supports both Default and Custom modes.
                        if user_mode == "custom":
                            sl_points = user_sl
                            target_points = user_target
                        else:
                            if user_strategy == "strategy_two":
                                # Strategy Two specific logic
                                # If candle size is less than 20 points (e.g. 14, 19), use it as SL.
                                # If candle size is 20 points or greater, SL is fixed to 20 points.
                                sl_points = candle_range if candle_range < 20 else 20
                                target_points = 2 * sl_points
                            else:
                                # Strategy One default logic
                                sl_points = min(candle_range, 20)
                                target_points = 2 * sl_points
                            
                        sl_price = entry_price + sl_points
                        target_price = entry_price - target_points
                        
                        add_log(user_id, f"📊 Strategy Signal Detected (INDEX):\ncandle_range: {candle_range:.2f}\nentry_price: {entry_price:.2f}")

                        opt_tok, opt_sym, option_ltp = order_manager.select_atm_option(
                            broker_ctx, inst_df, index_ltp, user_index
                        )
                        
                        add_log(user_id, f"🔍 ATM Result: tok={opt_tok} sym={opt_sym} ltp={option_ltp}")

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
                                    
                                    # ── 4. Calculate Premium SL/Target ──────────────
                                    if user_strategy == "strategy_one":
                                        opt_sl_pts = 20
                                        opt_tgt_pts = 40
                                    elif user_strategy == "strategy_two":
                                        candle_range = setup['high'] - setup['low']
                                        opt_sl_pts = candle_range if candle_range < 20 else 20
                                        opt_tgt_pts = opt_sl_pts * 2
                                    else:
                                        opt_sl_pts = 20
                                        opt_tgt_pts = 40
                                        
                                    opt_sl_price = round(executed_price - opt_sl_pts, 2)
                                    opt_target_price = round(executed_price + opt_tgt_pts, 2)
                                    
                                    add_log(user_id, f"💰 Premium SL: {opt_sl_price} | Target: {opt_target_price}")

                                    # ── 5. Store Real Broker Execution ──────────────
                                    store_broker_trade(
                                        user_id=user_id,
                                        strategy_trade_id=strat_id,
                                        symbol=opt_sym,
                                        qty=trade_qty,
                                        executed_price=executed_price,
                                        sl=opt_sl_price,        # Store Option SL
                                        target=opt_target_price, # Store Option Target
                                        broker_order_id=buy_order_id,
                                    )

                                    # ── 5.5 Place Stop-Loss Order at Broker ──────────────
                                    add_log(user_id, f"📤 Placing Stoploss order at broker for {opt_sl_price:.2f}...")
                                    sl_res = order_manager.place_sl_order(
                                        broker_ctx, opt_tok, opt_sym, trade_qty, opt_sl_price
                                    )
                                    sl_order_id = "UNKNOWN"
                                    if sl_res.get("success"):
                                        sl_order_id = sl_res["order_id"]
                                        add_log(user_id, f"✅ Stoploss order placed at broker | Order ID: {sl_order_id}")
                                    else:
                                        add_log(user_id, f"⚠️ Failed to place SL at broker! Error: {sl_res.get('message')} — BOT WILL MONITOR AS BACKUP")

                                    # Mark trade active ONLY after confirmed BUY execution
                                    active_trade = {
                                        "opt_tok":      opt_tok,
                                        "opt_sym":      opt_sym,
                                        "trade_qty":    trade_qty,
                                        "entry_price":  executed_price, # Option price
                                        "option_sl":    opt_sl_price,
                                        "option_target": opt_target_price,
                                        "buy_order_id": buy_order_id,
                                        "sl_order_id":  sl_order_id,
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
                            reason = []
                            if not opt_tok:
                                reason.append("No ATM token found in instrument list")
                            elif not option_ltp:
                                reason.append(f"LTP fetch failed for token={opt_tok} sym={opt_sym}")
                            add_log(user_id, f"❌ Failed to fetch option data — {'; '.join(reason) if reason else 'Unknown reason'}")
                            add_log(user_id, "⚠️ Check: broker session valid? NFO instruments loaded? Market open for options?")
                            clear_setup(user_id)

        time.sleep(1)

