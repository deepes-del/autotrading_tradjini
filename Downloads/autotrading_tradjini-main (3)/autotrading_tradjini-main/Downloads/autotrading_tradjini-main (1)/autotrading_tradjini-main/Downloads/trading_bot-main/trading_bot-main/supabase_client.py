import logging
import time
import threading
from supabase import create_client, Client

SUPABASE_URL = "https://facixicwwdoxrrowlosy.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhY2l4aWN3d2RveHJyb3dsb3N5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5MDI4MDYsImV4cCI6MjA5MTQ3ODgwNn0.i7XKXBjOxKZ8eJ1vr3ietK6qNEe9PkNRNhCOqnVmg2I"

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ── Retry wrapper for all Supabase operations ────────────────

def supabase_retry(operation, *args, retries=3, **kwargs):
    """
    Execute a Supabase operation with retry logic.
    Delays: 1s, 2s, 5s before the final failure.
    Only retries on connection-level errors (ConnectionTerminated,
    RemoteProtocolError, Server disconnected).
    Other errors propagate immediately.
    """
    delays = [1, 2, 5]
    last_exc = None
    for attempt in range(1, retries + 1):
        try:
            result = operation(*args, **kwargs)
            if attempt > 1:
                logging.info("[SUPABASE RECOVERED] operation succeeded after %d retries", attempt)
            return result
        except Exception as e:
            err_str = str(e)
            if any(token in err_str for token in (
                "ConnectionTerminated",
                "RemoteProtocolError",
                "Server disconnected",
                "connection reset",
                "connection refused",
                "timeout",
            )):
                last_exc = e
                if attempt < retries:
                    logging.warning(
                        "[SUPABASE RETRY] attempt %d/%d failed: %s",
                        attempt, retries, err_str[:120],
                    )
                    time.sleep(delays[attempt - 1])
                else:
                    logging.error(
                        "[SUPABASE FAILED] all %d attempts failed: %s",
                        retries, err_str[:200],
                    )
                    raise
            else:
                raise
    raise last_exc
