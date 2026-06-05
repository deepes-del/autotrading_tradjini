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
