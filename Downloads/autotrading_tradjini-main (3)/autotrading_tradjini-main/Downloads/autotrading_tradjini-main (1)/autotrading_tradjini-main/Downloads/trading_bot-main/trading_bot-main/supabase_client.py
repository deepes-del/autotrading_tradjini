import logging
import time
import threading
from supabase import create_client, Client

SUPABASE_URL = "https://facixicwwdoxrrowlosy.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhY2l4aWN3d2RveHJyb3dsb3N5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5MDI4MDYsImV4cCI6MjA5MTQ3ODgwNn0.i7XKXBjOxKZ8eJ1vr3ietK6qNEe9PkNRNhCOqnVmg2I"

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ── Retry wrapper for all Supabase operations ────────────────

def supabase_retry(operation, *args, retries=2, **kwargs):
    """
    Execute a Supabase operation with retry logic.
    Total attempts: 3 (Initial attempt + max 2 retries).
    Delays: 2s after 1st attempt, 5s after 2nd attempt.
    """
    import datetime
    delays = [2, 5]
    last_exc = None
    total_attempts = 1 + retries
    op_name = getattr(operation, '__name__', 'anonymous_callable')
    if op_name == '<lambda>':
        op_name = "lambda_operation"

    for attempt in range(1, total_attempts + 1):
        try:
            result = operation(*args, **kwargs)
            if attempt > 1:
                logging.info(f"[SUPABASE RECOVERED] {op_name} succeeded on attempt {attempt}")
            return result
        except Exception as e:
            err_str = str(e)
            timestamp = datetime.datetime.now(datetime.timezone.utc).isoformat()
            retry_count = attempt - 1
            logging.warning(
                f"[SUPABASE ERROR] Operation: {op_name} | Error: {err_str} | Timestamp: {timestamp} | Retry Count: {retry_count}"
            )

            # Check if retryable error
            if any(token in err_str for token in (
                "ConnectionTerminated",
                "RemoteProtocolError",
                "Server disconnected",
                "connection reset",
                "connection refused",
                "timeout",
            )):
                last_exc = e
                if attempt < total_attempts:
                    sleep_time = delays[attempt - 1]
                    logging.info(f"[SUPABASE RETRY] Sleeping {sleep_time}s before retry {attempt}...")
                    time.sleep(sleep_time)
                else:
                    logging.error(
                        f"[SUPABASE FAILED] Operation {op_name} permanently failed after {total_attempts} attempts: {err_str[:200]}"
                    )
                    raise
            else:
                raise
    raise last_exc

