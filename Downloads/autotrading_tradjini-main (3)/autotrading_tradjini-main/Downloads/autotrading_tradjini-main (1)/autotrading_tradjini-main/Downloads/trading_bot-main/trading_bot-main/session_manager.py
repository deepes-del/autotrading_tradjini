"""
session_manager.py
------------------
Production-grade broker session manager backed by Supabase — BYOK model.

Each user's broker session stores their own api_key, client_id, and
access_token independently.  No global shared state.

broker_sessions table columns required:
    user_id, broker_name, api_key, client_id, access_token,
    token_created_at, is_active
"""

import threading
import logging
import time
from supabase_client import supabase

local_runtime_state: dict = {}
_lock = threading.Lock()

_last_login_attempt: dict[str, float] = {}
_rate_lock = threading.Lock()

LOGIN_COOLDOWN_SECONDS = 60

# ── In-memory session cache ─────────────────────────────────
SESSION_CACHE: dict[str, dict] = {}
SESSION_CACHE_TTL = 300  # 5 minutes
_session_cache_lock = threading.Lock()


def _mask(value: str) -> str:
    if not value or len(value) < 9:
        return "****"
    return f"{value[:4]}{'*' * (len(value) - 8)}{value[-4:]}"


# ── Rate limiter ──────────────────────────────────────────────────────────────

def can_attempt_login(user_id: str) -> tuple[bool, float]:
    with _rate_lock:
        last = _last_login_attempt.get(user_id, 0.0)
        elapsed = time.time() - last
        if elapsed >= LOGIN_COOLDOWN_SECONDS:
            return True, 0.0
        return False, round(LOGIN_COOLDOWN_SECONDS - elapsed, 1)


def record_login_attempt(user_id: str) -> None:
    with _rate_lock:
        _last_login_attempt[user_id] = time.time()


# ── Broker session CRUD ───────────────────────────────────────────────────────

def create_user_session(
    user_id: str,
    api_key: str,
    client_id: str,
    access_token: str,
) -> None:
    """
    Upsert the user's broker session in Supabase.
    Stores api_key, client_id, and access_token per user.
    """
    try:
        data = {
            "user_id":          user_id,
            "broker_name":      "tradejini",
            "api_key":          api_key,
            "client_id":        client_id,
            "access_token":     access_token,
            "is_active":        True,
            "token_created_at": "now()",
        }

        # Check if exists
        existing = (
            supabase.table("broker_sessions")
            .select("id")
            .eq("user_id", user_id)
            .execute()
        )

        if existing.data:
            supabase.table("broker_sessions").update(data).eq("user_id", user_id).execute()
        else:
            supabase.table("broker_sessions").insert(data).execute()

        # Populate in-memory cache
        with _session_cache_lock:
            SESSION_CACHE[user_id] = {
                "api_key":       api_key,
                "access_token":  access_token,
                "client_id":     client_id,
                "_cached_at":    time.time(),
            }

        logging.info(
            f"[SESSION] Session created/updated | User: {user_id} | Client: {client_id} | Session Status: Active"
        )

    except Exception as exc:
        logging.error(f"[SESSION_MANAGER] Failed to create session for {user_id}: {exc}")


def get_user_session(user_id: str) -> dict | None:
    """
    Retrieve the active broker session — checks SESSION_CACHE first,
    then falls back to Supabase (with retry).
    Returns {api_key, access_token, client_id} or None.
    """
    now = time.time()

    # ── Check in-memory cache ─────────────────────────────────
    with _session_cache_lock:
        cached = SESSION_CACHE.get(user_id)
        if cached is not None:
            age = now - cached.get("_cached_at", 0)
            if age < SESSION_CACHE_TTL:
                logging.info(f"[CACHE HIT] Session for user {user_id} (age={age:.0f}s)")
                return {
                    "api_key":       cached["api_key"],
                    "access_token":  cached["access_token"],
                    "client_id":     cached.get("client_id", ""),
                }
            else:
                logging.info(f"[CACHE EXPIRED] Session for user {user_id} (age={age:.0f}s)")

    # ── Fallback to Supabase with retry ────────────────────────
    from supabase_client import supabase_retry
    try:
        res = supabase_retry(
            lambda: supabase.table("broker_sessions")
            .select("api_key, access_token, client_id")
            .eq("user_id", user_id)
            .eq("is_active", True)
            .execute()
        )
        if res and res.data:
            session = res.data[0]
            if session.get("api_key") and session.get("access_token"):
                # Populate cache
                with _session_cache_lock:
                    SESSION_CACHE[user_id] = {
                        "api_key":       session["api_key"],
                        "access_token":  session["access_token"],
                        "client_id":     session.get("client_id", ""),
                        "_cached_at":    now,
                    }
                logging.info(f"[CACHE MISS] Session loaded from Supabase for user {user_id}")
                return {
                    "api_key":       session["api_key"],
                    "access_token":  session["access_token"],
                    "client_id":     session.get("client_id", ""),
                }
            else:
                logging.warning(f"[SESSION] Incomplete session for User: {user_id}")
        return None
    except Exception as exc:
        logging.error(f"[SESSION_MANAGER] Failed to get session for {user_id}: {exc}")
        return None


def invalidate_user_session(user_id: str, reason: str = "MANUAL") -> None:
    """Mark a user's broker session as inactive."""
    try:
        supabase.table("broker_sessions").update({"is_active": False}).eq("user_id", user_id).execute()
    except Exception as exc:
        logging.error(f"[SESSION_MANAGER] Failed to invalidate session in Supabase for {user_id}: {exc}")
    # Always clear cache regardless of DB success
    with _session_cache_lock:
        SESSION_CACHE.pop(user_id, None)
    with _lock:
        local_runtime_state.pop(user_id, None)
    logging.info(f"[SESSION] Session invalidated | User: {user_id} | Reason: {reason}")


def delete_user_session(user_id: str) -> None:
    invalidate_user_session(user_id, reason="DELETE")


def has_session(user_id: str) -> bool:
    return get_user_session(user_id) is not None


# ── Runtime State (setup candle — local only) ─────────────────────────────────

def set_setup(user_id: str, setup_data: dict) -> None:
    with _lock:
        if user_id not in local_runtime_state:
            local_runtime_state[user_id] = {}
        local_runtime_state[user_id]["setup"] = setup_data


def get_setup(user_id: str) -> dict | None:
    with _lock:
        state = local_runtime_state.get(user_id)
        return state.get("setup") if state else None


def clear_setup(user_id: str) -> None:
    with _lock:
        if user_id in local_runtime_state:
            local_runtime_state[user_id]["setup"] = None


def attempt_broker_auto_login(user_id: str) -> bool:
    """
    Load credentials from database, perform complete Tradejini login flow,
    save new broker session to DB, and return success status.
    If login fails or credentials missing, disable trading for that user.
    """
    from tradejini_login import login_tradejini
    
    try:
        # Load from broker_configs
        res = supabase.table("broker_configs").select("*").eq("user_id", user_id).execute()
        if not res.data:
            logging.error(
                f"[AUTO LOGIN FAILED]\n\n"
                f"User: {user_id}\n\n"
                f"Reason:\n"
                f"Broker configuration missing"
            )
            _disable_trading(user_id)
            return False
            
        cfg = res.data[0]
        client_id = cfg.get("client_id")
        api_key = cfg.get("api_key")
        totp_secret = cfg.get("totp_secret")
        trading_pin = cfg.get("trading_pin")
        
        # Validation checks
        missing = []
        if not client_id:
            missing.append("client_id")
        if not api_key:
            missing.append("api_key")
        if not totp_secret:
            missing.append("totp_secret")
        if not trading_pin:
            missing.append("trading_pin")
            
        if missing:
            # Let's map technical name to display name for logging
            name_map = {
                "client_id": "Client ID",
                "api_key": "API Key",
                "totp_secret": "TOTP",
                "trading_pin": "Trading PIN"
            }
            # Log exact format for missing credential
            logging.error(
                f"[AUTO LOGIN FAILED]\n\n"
                f"Missing credential:\n"
                f"{missing[0]}"
            )
            logging.error(
                f"[AUTO LOGIN FAILED]\n\n"
                f"User: {user_id}\n\n"
                f"Reason:\n"
                f"{name_map[missing[0]]} missing"
            )
            _disable_trading(user_id)
            return False
            
        # Log successful load check (values masked)
        logging.info(
            f"[AUTO LOGIN]\n\n"
            f"User: {user_id}\n\n"
            f"Using stored credentials:\n"
            f"Client ID ✔\n"
            f"API Key ✔\n"
            f"TOTP ✔\n"
            f"Trading PIN ✔"
        )
        
        # Custom required log message
        print(f"[AUTO LOGIN]\nUser: {user_id}\nUsing Stored Broker Credentials", flush=True)
        
        # Login
        token, err_msg, is_blocked = login_tradejini(api_key, client_id, trading_pin, totp_secret)
        
        if is_blocked:
            logging.critical(f"[AUTO LOGIN BLOCKED] Account blocked for User: {user_id} | Reason: {err_msg}")
            _disable_trading(user_id)
            return False
            
        if not token:
            logging.error(
                f"[AUTO LOGIN FAILED]\n\n"
                f"User: {user_id}\n\n"
                f"Reason:\n"
                f"{err_msg or 'Unknown login error'}"
            )
            _disable_trading(user_id)
            return False
            
        # Invalidate stale cache entry
        with _session_cache_lock:
            SESSION_CACHE.pop(user_id, None)

        # Save session
        normalized_client_id = client_id.strip().upper()
        create_user_session(user_id, api_key.strip(), normalized_client_id, token)
        
        logging.info(
            f"[SESSION REFRESH SUCCESS]\n\n"
            f"User: {user_id}\n\n"
            f"New broker session created"
        )
        
        # Custom required log message
        print(f"[SESSION REFRESH SUCCESS]\nUser: {user_id}", flush=True)
        return True
        
    except Exception as exc:
        logging.error(
            f"[AUTO LOGIN FAILED]\n\n"
            f"User: {user_id}\n\n"
            f"Reason:\n"
            f"{exc}"
        )
        _disable_trading(user_id)
        return False


def _disable_trading(user_id: str):
    """
    Disable trading for the user: stop their bot thread and set bot_running = False in DB.
    """
    from main import running_bots
    bot = running_bots.get(user_id)
    if bot:
        bot["config"]["stop_requested"] = True
        
    try:
        supabase.table("users").update({"bot_running": False}).eq("user_id", user_id).execute()
        update_cached_user_status(user_id, bot_running=False)
        logging.info(f"[AUTO LOGIN] Trading disabled and bot stopped for User: {user_id}")
    except Exception as exc:
        logging.error(f"[AUTO LOGIN] Failed to update users table to stop bot: {exc}")

# ── Central User Status Caching ─────────────────────────────────────────────

USER_STATUS_CACHE: dict[str, dict] = {}
user_status_lock = threading.Lock()
_status_sync_started = False
_status_sync_lock = threading.Lock()

def get_cached_user_status(user_id: str) -> dict | None:
    with user_status_lock:
        return USER_STATUS_CACHE.get(user_id)

def update_cached_user_status(user_id: str, status: str | None = None, bot_running: bool | None = None) -> None:
    with user_status_lock:
        if user_id not in USER_STATUS_CACHE:
            USER_STATUS_CACHE[user_id] = {"status": "approved", "bot_running": False}
        if status is not None:
            USER_STATUS_CACHE[user_id]["status"] = status
        if bot_running is not None:
            USER_STATUS_CACHE[user_id]["bot_running"] = bot_running

def start_user_status_sync_loop():
    global _status_sync_started
    with _status_sync_lock:
        if not _status_sync_started:
            t = threading.Thread(target=_user_status_sync_loop, daemon=True)
            t.start()
            _status_sync_started = True
            logging.info("[USER_STATUS_SYNC] Started user status sync background thread.")

def _user_status_sync_loop():
    from supabase_client import supabase_retry
    while True:
        try:
            res = supabase_retry(
                lambda: supabase.table("users").select("user_id, status, bot_running").execute()
            )
            if res and res.data:
                new_cache = {}
                for row in res.data:
                    u_id = row.get("user_id")
                    if u_id:
                        new_cache[u_id] = {
                            "status": row.get("status"),
                            "bot_running": row.get("bot_running", False)
                        }
                with user_status_lock:
                    USER_STATUS_CACHE.clear()
                    USER_STATUS_CACHE.update(new_cache)
        except Exception as e:
            logging.error(f"[USER_STATUS_SYNC] Error in user status sync: {e}")
        time.sleep(20)

