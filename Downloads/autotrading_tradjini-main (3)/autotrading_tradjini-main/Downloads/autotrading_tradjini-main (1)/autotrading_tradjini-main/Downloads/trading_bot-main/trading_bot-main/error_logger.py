"""
error_logger.py  –  Central error logging utility for CubePlus Trading SaaS.

Every broker error or system failure is:
  1. Persisted in Supabase `user_errors` table (never lost).
  2. Written to the Python logging stream (console / log file).

Usage:
    from error_logger import log_error
    log_error(user_id, "ORDER_FAILED", "Invalid IP address", raw=result["raw"])

Severity levels: INFO | WARNING | ERROR | CRITICAL
"""

import logging
from supabase_client import supabase

logger = logging.getLogger(__name__)

# ── Valid severity levels ────────────────────────────────────
_VALID_SEVERITY = {"INFO", "WARNING", "ERROR", "CRITICAL"}


def log_error(
    user_id: str,
    error_type: str,
    message: str,
    raw=None,
    severity: str = "ERROR",
) -> None:
    """
    Persist a user-scoped error to Supabase and emit a console log.

    Args:
        user_id    : Platform user ID (required).
        error_type : Short code, e.g. "ORDER_FAILED", "LOGIN_FAILED".
        message    : Human-readable error description.
        raw        : Optional dict/list payload from the broker (stored as JSONB).
        severity   : One of INFO | WARNING | ERROR | CRITICAL (default ERROR).

    Guarantees:
        - NEVER raises an exception — logging must never crash the bot.
        - raw is coerced to a JSON-serialisable form before insert.
    """
    if not user_id:
        logger.warning("[ERROR_LOGGER] log_error called with empty user_id — skipped.")
        return

    severity = severity.upper() if severity else "ERROR"
    if severity not in _VALID_SEVERITY:
        severity = "ERROR"

    # ── Coerce raw to something JSONB-safe ───────────────────
    safe_raw = _safe_jsonb(raw)

    # ── 1. Persist to Supabase ───────────────────────────────
    try:
        from supabase_client import supabase_retry
        supabase_retry(
            lambda: supabase.table("user_errors").insert(
                {
                    "user_id":       user_id,
                    "error_type":    error_type,
                    "error_message": message,
                    "severity":      severity,
                    "raw_response":  safe_raw,
                }
            ).execute()
        )
    except Exception as db_exc:
        # Non-fatal: log to console and continue
        logger.error(
            f"[ERROR_LOGGER] Supabase insert failed for user={user_id} "
            f"type={error_type}: {db_exc}"
        )

    # ── 2. Console / file log ────────────────────────────────
    log_line = f"[{user_id}] {error_type}: {message}"
    if severity == "CRITICAL":
        logger.critical(log_line)
    elif severity == "WARNING":
        logger.warning(log_line)
    elif severity == "INFO":
        logger.info(log_line)
    else:
        logger.error(log_line)


def log_info(user_id: str, event_type: str, message: str, raw=None) -> None:
    """Convenience wrapper for INFO-severity events."""
    log_error(user_id, event_type, message, raw=raw, severity="INFO")


# ── Internal helpers ─────────────────────────────────────────

def _safe_jsonb(value):
    """
    Convert `value` to a JSONB-safe Python object (dict / list / None).
    If it's already a dict or list, return as-is.
    If it's a string, wrap it in {"raw": value}.
    Otherwise stringify it.
    """
    if value is None:
        return None
    if isinstance(value, (dict, list)):
        return value
    if isinstance(value, str):
        return {"raw": value}
    try:
        return {"raw": str(value)}
    except Exception:
        return None
