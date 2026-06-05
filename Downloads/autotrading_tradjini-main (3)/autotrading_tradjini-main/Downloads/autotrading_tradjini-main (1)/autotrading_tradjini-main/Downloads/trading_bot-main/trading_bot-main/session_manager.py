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

        logging.info(
            f"[SESSION] Session created/updated | User: {user_id} | Client: {client_id} | Session Status: Active"
        )

    except Exception as exc:
        logging.error(f"[SESSION_MANAGER] Failed to create session for {user_id}: {exc}")


def get_user_session(user_id: str) -> dict | None:
    """
    Retrieve the active broker session from Supabase.
    Returns {api_key, access_token, client_id} or None.
    """
    try:
        res = (
            supabase.table("broker_sessions")
            .select("api_key, access_token, client_id")
            .eq("user_id", user_id)
            .eq("is_active", True)
            .execute()
        )
        if res.data:
            session = res.data[0]
            if session.get("api_key") and session.get("access_token"):
                logging.info(f"[SESSION] Session loaded successfully | User: {user_id} | Client: {session.get('client_id')}")
                return {
                    "api_key": session["api_key"],
                    "access_token": session["access_token"],
                    "client_id": session.get("client_id", ""),
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
        with _lock:
            local_runtime_state.pop(user_id, None)
        logging.info(f"[SESSION] Session invalidated | User: {user_id} | Reason: {reason}")
    except Exception as exc:
        logging.error(f"[SESSION_MANAGER] Failed to invalidate session for {user_id}: {exc}")


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
            
        # Save session
        normalized_client_id = client_id.strip().upper()
        create_user_session(user_id, api_key.strip(), normalized_client_id, token)
        
        logging.info(
            f"[SESSION REFRESH SUCCESS]\n\n"
            f"User: {user_id}\n\n"
            f"New broker session created"
        )
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
        logging.info(f"[AUTO LOGIN] Trading disabled and bot stopped for User: {user_id}")
    except Exception as exc:
        logging.error(f"[AUTO LOGIN] Failed to update users table to stop bot: {exc}")
