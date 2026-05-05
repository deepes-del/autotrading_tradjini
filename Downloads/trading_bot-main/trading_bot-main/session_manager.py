"""
session_manager.py
------------------
Thread-safe in-memory session store for all connected broker users.

Schema per user:
    user_sessions[user_id] = {
        "client_id"    : str   – Tradejini client ID
        "access_token" : str   – Bearer token returned by Tradejini login
        "is_active"    : bool  – True once the bot is running
        "setup"        : dict  – {low, high, ema, time} for strategy
    }
"""

import threading

# Global session registry  {user_id -> session_dict}
user_sessions: dict = {}
_lock = threading.Lock()


def store_session(user_id: str, client_id: str, access_token: str) -> None:
    """Create or overwrite a session for the given user."""
    with _lock:
        user_sessions[user_id] = {
            "client_id": client_id,
            "access_token": access_token,
            "is_active": False,
            "setup": None,
        }
    print(f"[SESSION] Stored session for user: {user_id}")


def get_session(user_id: str) -> dict | None:
    """Return the session dict for a user, or None if not found."""
    return user_sessions.get(user_id)


def set_active(user_id: str, active: bool) -> None:
    """Mark a user's session as active/inactive."""
    with _lock:
        if user_id in user_sessions:
            user_sessions[user_id]["is_active"] = active


def remove_session(user_id: str) -> None:
    """Delete a session (e.g. on explicit logout)."""
    with _lock:
        user_sessions.pop(user_id, None)
    print(f"[SESSION] Removed session for user: {user_id}")


def has_session(user_id: str) -> bool:
    """Return True if a valid session exists for the user."""
    return user_id in user_sessions


def set_setup(user_id: str, setup_data: dict) -> None:
    """Store strategy setup data for a user."""
    with _lock:
        if user_id in user_sessions:
            user_sessions[user_id]["setup"] = setup_data


def get_setup(user_id: str) -> dict | None:
    """Retrieve strategy setup data for a user."""
    session = user_sessions.get(user_id)
    return session.get("setup") if session else None


def clear_setup(user_id: str) -> None:
    """Clear strategy setup data for a user."""
    with _lock:
        if user_id in user_sessions:
            user_sessions[user_id]["setup"] = None
