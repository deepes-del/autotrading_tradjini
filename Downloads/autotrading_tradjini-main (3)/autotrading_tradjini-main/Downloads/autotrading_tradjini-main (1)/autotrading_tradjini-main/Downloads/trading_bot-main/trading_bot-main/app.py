"""
app.py  –  FastAPI backend for the Tradejini multi-user trading platform.
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from fastapi.responses import FileResponse
from auth import (
    register_user, 
    login_user, 
    create_app_session, 
    validate_app_session, 
    deactivate_app_session
)
from tradejini_login import login_tradejini
from session_manager import (
    create_user_session,
    get_user_session,
    delete_user_session,
    invalidate_user_session,
    has_session,
    can_attempt_login,
    record_login_attempt,
)
import os
import logging
import threading
from datetime import datetime, timezone
from supabase_client import supabase

# Suppress noisy access logs for the /logs polling endpoint
logging.getLogger("uvicorn.access").setLevel(logging.WARNING)

app = FastAPI()

# Admin sessions are now persisted in app_sessions table as well.

# ──────────────────────────────────────────────────────────────
# Static page
# ──────────────────────────────────────────────────────────────

@app.get("/")
def home():
    file_path = os.path.join(os.path.dirname(__file__), "index.html")
    return FileResponse(file_path)

@app.get("/admin")
def admin_page():
    file_path = os.path.join(os.path.dirname(__file__), "admin.html")
    return FileResponse(file_path)


# ──────────────────────────────────────────────────────────────
# Platform auth  (Supabase)
# ──────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    name: str
    age: int
    occupation: str
    phone: str
    password: str

class LoginRequest(BaseModel):
    user_id: str
    password: str

class BrokerCredentials(BaseModel):
    session_token: str
    password: str | None = None       # Trading PIN — backend only, never logged
    api_key: str | None = None
    client_id: str | None = None
    totp_secret: str | None = None

class BrokerConfigRequest(BaseModel):
    session_token: str
    api_key: str | None = None
    client_id: str | None = None
    totp_secret: str | None = None
    trading_pin: str | None = None

class BotConfig(BaseModel):
    session_token: str
    strategy: str = "strategy_one"
    mode: str = "default"
    sl: int = 25
    target: int = 50
    index: str = "NIFTY"
    lots: int = 1

class StopBotRequest(BaseModel):
    session_token: str

class AdminLoginReq(BaseModel):
    username: str
    password: str

class AdminActionReq(BaseModel):
    admin_token: str
    user_id: str

@app.post("/register")
def register(req: RegisterRequest):
    return register_user(
        req.name,
        req.age,
        req.occupation,
        req.phone,
        req.password
    )


@app.post("/login")
def login(req: LoginRequest):
    user = login_user(req.user_id, req.password)

    if user:
        # Create a persistent session in Supabase
        session_token = create_app_session(user["user_id"])
        if session_token:
            logging.info(f"[AUTH] Login successful for {user['user_id']}")
            return {"status": "success", "session_token": session_token}
        else:
            return {"error": "Failed to create session"}

    return {"error": "Invalid credentials"}


@app.post("/logout")
def logout(req: StopBotRequest):
    deactivate_app_session(req.session_token)
    return {"status": "success"}


# ──────────────────────────────────────────────────────────────
# Broker connection  (Tradejini)
# ──────────────────────────────────────────────────────────────

@app.get("/broker-config")
def get_broker_config(session_token: str):
    """Fetch masked broker configuration (Persistent BYOK details)."""
    user_id = validate_app_session(session_token)
    if not user_id:
        return {"error": "Invalid session"}
    
    try:
        logging.info(f"[BROKER_CONFIG_FETCH] Fetching config for user_id={user_id}")
        res = supabase.table("broker_configs").select("*").eq("user_id", user_id).execute()
        if not res.data:
            return {"configured": False}
        
        cfg = res.data[0]
        
        def mask_api(val):
            if not val or len(val) < 8: return "****"
            return f"{val[:4]}****{val[-3:]}"

        def mask_client(val):
            if not val or len(val) < 4: return "***"
            return f"{val[:3]}***"

        return {
            "configured": True,
            "api_key": mask_api(cfg["api_key"]),
            "client_id": mask_client(cfg["client_id"]),
            "totp_secret": "****", # Masked for UI
            "trading_pin": "****", # Masked for UI
            "totp_configured": True,
            "updated_at": cfg["updated_at"]
        }
    except Exception as e:
        logging.error(f"[CONFIG] Fetch error: {e}")
        return {"error": str(e)}

@app.post("/api/broker/save")
def update_broker_config(req: BrokerConfigRequest):
    """Update/Insert persistent broker credentials (BYOK)."""
    user_id = validate_app_session(req.session_token)
    if not user_id:
        return {"error": "Invalid session"}
    
    try:
        # Fetch existing config to allow partial updates
        existing = supabase.table("broker_configs").select("*").eq("user_id", user_id).execute()
        cfg = existing.data[0] if existing.data else {}

        api_key = req.api_key.strip() if req.api_key else cfg.get("api_key")
        client_id = req.client_id.strip().upper() if req.client_id else cfg.get("client_id")
        totp_secret = req.totp_secret.strip() if req.totp_secret else cfg.get("totp_secret")
        trading_pin = req.trading_pin.strip() if req.trading_pin else cfg.get("trading_pin")

        if not (api_key and client_id and totp_secret and trading_pin):
            return {"error": "All fields are required for initial setup."}

        data = {
            "user_id":     user_id,
            "broker_name": "tradejini",
            "api_key":     api_key,
            "client_id":   client_id,
            "totp_secret": totp_secret,
            "trading_pin": trading_pin,
            "updated_at":  datetime.now(timezone.utc).isoformat()
        }
        
        # Explicit on_conflict for clarity, using dict as requested
        res = supabase.table("broker_configs").upsert(data, on_conflict="user_id").execute()
        
        # Security: Invalidate current broker session
        invalidate_user_session(user_id, reason="CREDENTIALS_UPDATED")
        
        if existing.data:
            logging.info(f"[BROKER_CONFIG_UPDATE] Successfully updated broker config for user_id={user_id}")
        else:
            logging.info(f"[BROKER_CONFIG_SAVE] Successfully inserted broker config for user_id={user_id}")
            
        return {"status": "success", "message": "Broker settings saved successfully."}
    except Exception as e:
        logging.error(f"[CONFIG] Update error for {user_id}: {str(e)}")
        return {"error": f"Database error: {str(e)}"}

@app.post("/connect-broker")
def connect_broker(creds: BrokerCredentials):
    """
    Connect to broker using either provided or stored credentials.
    """
    from error_logger import log_error

    user_id = validate_app_session(creds.session_token)
    if not user_id:
        return {"error": "Invalid or expired platform session."}

    allowed, wait_secs = can_attempt_login(user_id)
    if not allowed:
        return {"error": f"Please wait {wait_secs} seconds."}

    record_login_attempt(user_id)

    # ── Fetch stored credentials if missing ────────────────────────────
    api_key = creds.api_key
    client_id = creds.client_id
    totp_secret = creds.totp_secret
    trading_pin = creds.password.strip() if creds.password else None

    if not (api_key and client_id and totp_secret and trading_pin):
        try:
            res = supabase.table("broker_configs").select("*").eq("user_id", user_id).execute()
            if not res.data:
                return {"error": "Broker not configured. Please save settings first."}
            cfg = res.data[0]
            api_key = api_key or cfg.get("api_key")
            client_id = client_id or cfg.get("client_id")
            totp_secret = totp_secret or cfg.get("totp_secret")
            trading_pin = trading_pin or cfg.get("trading_pin")
        except Exception as e:
            return {"error": f"Failed to fetch stored config: {e}"}

    if not trading_pin:
        return {"error": "Trading PIN is missing. Please save settings first."}

    logging.info(f"[BROKER_LOGIN] Connect request | user={user_id} | client={client_id}")

    # ── Call Tradejini login ───────────────────────────────────────────────
    token, err_msg, is_blocked = login_tradejini(api_key, client_id, trading_pin, totp_secret)

    if is_blocked:
        invalidate_user_session(user_id, reason="ACCOUNT_BLOCKED")
        log_error(user_id, "ACCOUNT_BLOCKED", err_msg or "Blocked", severity="CRITICAL")
        return {"error": "Account blocked. Contact support."}

    if not token:
        log_error(user_id, "BROKER_LOGIN_FAILED", err_msg or "Unknown", severity="ERROR")
        return {"error": f"Login failed: {err_msg}"}

    # ── Success ──────────────────────────────────────────────────────────
    normalized_client_id = client_id.strip().upper()
    create_user_session(user_id, api_key.strip(), normalized_client_id, token)

    # Store all credentials securely in broker_configs
    try:
        data = {
            "user_id":     user_id,
            "broker_name": "tradejini",
            "api_key":     api_key.strip(),
            "client_id":   normalized_client_id,
            "totp_secret": totp_secret.strip(),
            "trading_pin": trading_pin.strip(),
            "updated_at":  datetime.now(timezone.utc).isoformat()
        }
        supabase.table("broker_configs").upsert(data, on_conflict="user_id").execute()
        # Custom required log message
        print(f"[BROKER CONNECTED]\nUser: {user_id}\nTrading PIN Stored: YES", flush=True)
    except Exception as e:
        logging.error(f"Failed to persist broker credentials in broker_configs: {e}")


    return {"status": "Broker connected successfully", "user_id": user_id}


# ──────────────────────────────────────────────────────────────
# Broker login diagnostic  (auth test only — no strategy)
# ──────────────────────────────────────────────────────────────

class TestBrokerLoginRequest(BaseModel):
    session_token: str
    api_key: str         # User's own Tradejini API key (BYOK)
    client_id: str
    password: str        # Trading PIN
    totp_secret: str     # TOTP secret

@app.post("/test-broker-login")
def test_broker_login(req: TestBrokerLoginRequest):
    """
    Diagnostic endpoint: test Tradejini credentials safely.

    - Does NOT start the strategy.
    - Does NOT place orders.
    - Does NOT store a broker session.
    - Does NOT start LTP or candle polling.
    - Rate-limited: 60 seconds between attempts per user.

    Use this to verify credentials before using /connect-broker.
    """
    from error_logger import log_error

    user_id = validate_app_session(req.session_token)
    if not user_id:
        return {"error": "Invalid or expired platform session. Please log in again."}

    # Rate-limit check (same pool as /connect-broker to prevent abuse)
    allowed, wait_secs = can_attempt_login(user_id)
    if not allowed:
        return {"error": f"Please wait {wait_secs}s before testing again."}

    record_login_attempt(user_id)

    logging.info(f"[TEST_BROKER_LOGIN] user={user_id} | client={req.client_id.strip().upper()}")

    token, err_msg, is_blocked = login_tradejini(
        req.api_key, req.client_id, req.password, req.totp_secret
    )

    if is_blocked:
        log_error(user_id, "ACCOUNT_BLOCKED", err_msg or "Blocked", severity="CRITICAL")
        return {
            "success": False,
            "blocked": True,
            "message": "Account temporarily blocked due to incorrect attempts.",
        }

    if not token:
        return {
            "success": False,
            "blocked": False,
            "message": f"Login test failed: {err_msg}",
        }

    # Do NOT store the session here — this is a test only
    logging.info(f"[TEST_BROKER_LOGIN] SUCCESS for user={user_id} | credentials are valid")
    return {
        "success": True,
        "blocked": False,
        "message": "Credentials valid. Use /connect-broker to connect.",
    }



# ──────────────────────────────────────────────────────────────
# Bot control
# ──────────────────────────────────────────────────────────────

def update_bot_status(user_id: str, is_running: bool):
    from supabase_client import supabase_retry
    try:
        supabase_retry(
            lambda: supabase.table("users").update({"bot_running": is_running}).eq("user_id", user_id).execute()
        )
        import session_manager
        session_manager.update_cached_user_status(user_id, bot_running=is_running)
    except Exception as e:
        logging.error(f"Error updating bot status: {e}")

@app.get("/bot/status")
def bot_status(session_token: str):
    # 1. Validate app session from app_sessions table
    user_id = validate_app_session(session_token)
    if not user_id:
        return {"status": "disconnected", "bot_running": False, "error": "Invalid session"}

    # 2. Fetch broker session from broker_sessions
    session = get_user_session(user_id)

    # 3. Fetch bot_running state
    from supabase_client import supabase_retry
    res = supabase_retry(
        lambda: supabase.table("users").select("bot_running").eq("user_id", user_id).execute()
    )
    bot_running = False
    if res and res.data:
        bot_running = res.data[0].get("bot_running", False)

    if session:
        return {
            "status": "connected", 
            "bot_running": bot_running, 
            "client_id": session.get("client_id", "Unknown")
        }
    
    return {"status": "disconnected", "bot_running": bot_running}

@app.post("/start-bot")
def start_bot_api(config: BotConfig):
    from main import start_bot

    user_id = validate_app_session(config.session_token)
    if not user_id:
        return {"error": "Invalid platform session"}
    
    # Check if approved
    try:
        user_res = supabase.table("users").select("status").eq("user_id", user_id).execute()
        if not user_res.data or user_res.data[0]["status"] != "approved":
            return {"error": "User is not approved by admin. Cannot start bot."}
    except Exception as e:
        return {"error": "Failed to verify user status"}

    if not has_session(user_id):
        return {"error": "Broker not connected. Call /connect-broker first."}

    user_config = {
        "user_id": user_id,
        "strategy": config.strategy,
        "mode": config.mode,
        "sl": config.sl,
        "target": config.target,
        "index": config.index,
        "lots": config.lots,
        "is_running": True,
        "stop_requested": False,
    }

    session = get_user_session(user_id)
    if not session:
        raise HTTPException(status_code=400, detail="Broker not connected. Please connect first.")

    # Synchronously update bot status to True in DB and cache BEFORE starting the thread
    update_bot_status(user_id, True)

    started = start_bot(user_id, user_config)

    if started:
        return {"status": "Bot started", "user_id": user_id}
    else:
        # Revert status if bot failed to start
        update_bot_status(user_id, False)
        return {"error": "Bot is already running for this user"}


@app.post("/stop-bot")
def stop_bot_api(req: StopBotRequest):
    from main import running_bots

    user_id = validate_app_session(req.session_token)
    if not user_id:
        return {"error": "Invalid platform session"}

    if user_id in running_bots:
        running_bots[user_id]["config"]["stop_requested"] = True
        update_bot_status(user_id, False)
        return {"status": "Stop signal sent"}

    return {"error": "No running bot found for this user"}


# ──────────────────────────────────────────────────────────────
# Bot Config Persistence
# ──────────────────────────────────────────────────────────────

@app.post("/api/bot-config/save")
def save_bot_config(config: BotConfig):
    user_id = validate_app_session(config.session_token)
    if not user_id:
        return {"error": "Invalid session"}
    
    try:
        data = {
            "user_id": user_id,
            "index_name": config.index,
            "strategy_name": config.strategy,
            "mode": config.mode,
            "sl_points": config.sl,
            "target_points": config.target,
            "lots": config.lots,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        # Upsert based on user_id and index_name
        res = supabase.table("bot_configs").upsert(data, on_conflict="user_id,index_name").execute()
        return {"status": "success", "message": "Bot configuration saved."}
    except Exception as e:
        logging.error(f"[BOT_CONFIG] Save error: {e}")
        return {"error": str(e)}

@app.get("/api/bot-config")
def get_bot_config(session_token: str, index: str):
    user_id = validate_app_session(session_token)
    if not user_id:
        return {"error": "Invalid session"}
    
    try:
        res = supabase.table("bot_configs").select("*").eq("user_id", user_id).eq("index_name", index).execute()
        if res.data:
            return {"status": "success", "config": res.data[0]}
        return {"status": "not_found"}
    except Exception as e:
        logging.error(f"[BOT_CONFIG] Fetch error: {e}")
        return {"error": str(e)}


# ──────────────────────────────────────────────────────────────
# Log streaming
# ──────────────────────────────────────────────────────────────

@app.get("/logs")
def get_logs(session_token: str):
    from main import user_logs

    user_id = validate_app_session(session_token)
    if not user_id:
        return {"error": "Invalid platform session"}
    return {"logs": user_logs.get(user_id, [])}


# ──────────────────────────────────────────────────────────────
# Admin API
# ──────────────────────────────────────────────────────────────

@app.post("/admin/login")
def admin_login(req: AdminLoginReq):
    try:
        res = supabase.table("admin").select("*").eq("username", req.username).execute()
        if res.data and res.data[0]["password"] == req.password:
            # Create a persistent session for admin
            admin_user_id = f"admin:{req.username}"
            admin_token = create_app_session(admin_user_id)
            if admin_token:
                return {"status": "success", "admin_token": admin_token}
    except Exception as e:
        logging.error(f"Admin login error: {e}")
    return {"error": "Invalid admin credentials"}

@app.get("/admin/dashboard")
def admin_dashboard(admin_token: str):
    from supabase_client import supabase_retry
    admin_id = validate_app_session(admin_token)
    if not admin_id or not admin_id.startswith("admin:"):
        return {"error": "Unauthorized"}
    try:
        # 1. Fetch users
        users_res = supabase_retry(
            lambda: supabase.table("users").select("user_id, name, phone, status, bot_running, created_at").execute()
        )

        # 2. Fetch broker configs status
        configs_res = supabase_retry(
            lambda: supabase.table("broker_configs").select("user_id, updated_at").execute()
        )
        configs_map = {c["user_id"]: c["updated_at"] for c in configs_res.data} if configs_res and configs_res.data else {}

        # 3. Fetch broker sessions status
        sessions_res = supabase_retry(
            lambda: supabase.table("broker_sessions").select("user_id, client_id, is_active, token_created_at").execute()
        )
        sessions_map = {s["user_id"]: s for s in sessions_res.data} if sessions_res and sessions_res.data else {}

        # 4. Fetch active bot info from main memory
        from main import running_bots

        # 5. Combine
        results = []
        for u in (users_res.data if users_res and users_res.data else []):
            u_id = u["user_id"]
            u["broker_configured"] = u_id in configs_map
            u["broker_updated_at"] = configs_map.get(u_id)

            session_info = sessions_map.get(u_id, {})
            u["broker_client_id"] = session_info.get("client_id")
            u["session_active"] = session_info.get("is_active", False)
            u["token_created_at"] = session_info.get("token_created_at")

            # Add active bot info
            if u_id in running_bots:
                cfg = running_bots[u_id].get("config", {})
                u["active_strategy"] = cfg.get("strategy")
                u["active_mode"] = cfg.get("mode")
                u["active_sl"] = cfg.get("sl")
                u["active_target"] = cfg.get("target")
                u["active_index"] = cfg.get("index")

            results.append(u)

        return {"users": results}
    except Exception as e:
        return {"error": str(e)}

@app.post("/admin/approve")
def admin_approve(req: AdminActionReq):
    from supabase_client import supabase_retry
    admin_id = validate_app_session(req.admin_token)
    if not admin_id or not admin_id.startswith("admin:"):
        return {"error": "Unauthorized"}
    try:
        supabase_retry(
            lambda: supabase.table("users").update({"status": "approved"}).eq("user_id", req.user_id).execute()
        )
        import session_manager
        session_manager.update_cached_user_status(req.user_id, status="approved")
        return {"status": f"User {req.user_id} approved"}
    except Exception as e:
        return {"error": str(e)}

@app.post("/admin/start-bot")
def admin_start_bot(req: AdminActionReq):
    admin_id = validate_app_session(req.admin_token)
    if not admin_id or not admin_id.startswith("admin:"):
        return {"error": "Unauthorized"}
    
    from main import start_bot
    if not has_session(req.user_id):
        return {"error": "Broker not connected for this user"}

    user_config = {
        "user_id": req.user_id,
        "strategy": "strategy_one",
        "mode": "default",
        "sl": 25,
        "target": 50,
        "index": "NIFTY",
        "lots": 1,
        "is_running": True,
        "stop_requested": False,
    }

    # Synchronously update bot status to True in DB and cache BEFORE starting the thread
    update_bot_status(req.user_id, True)

    started = start_bot(req.user_id, user_config)
    if started:
        return {"status": f"Bot started for {req.user_id}"}
    else:
        update_bot_status(req.user_id, False)
        return {"error": "Bot already running"}


# ── Admin helpers ──────────────────────────────────────────

def _stop_user_bot(user_id: str) -> bool:
    """
    Signal the bot thread to stop and sync state to Supabase.
    Returns True if a running bot was found and signalled.
    Thread-safe: only sets a flag; the thread exits on its own loop iteration.
    """
    from supabase_client import supabase_retry
    from main import running_bots
    bot = running_bots.get(user_id)
    import session_manager
    if bot:
        bot["config"]["stop_requested"] = True
        try:
            supabase_retry(
                lambda: supabase.table("users").update({"bot_running": False}).eq("user_id", user_id).execute()
            )
            session_manager.update_cached_user_status(user_id, bot_running=False)
        except Exception as e:
            logging.error(f"[ADMIN] Supabase update failed on stop-bot for {user_id}: {e}")
        logging.info(f"[ADMIN] Stop signal sent to bot for user {user_id}")
        return True
    # Bot not running — still ensure DB is consistent
    try:
        supabase_retry(
            lambda: supabase.table("users").update({"bot_running": False}).eq("user_id", user_id).execute()
        )
        session_manager.update_cached_user_status(user_id, bot_running=False)
    except Exception:
        pass
    return False


@app.post("/admin/stop-bot")
def admin_stop_bot(req: AdminActionReq):
    admin_id = validate_app_session(req.admin_token)
    if not admin_id or not admin_id.startswith("admin:"):
        return {"error": "Unauthorized"}
    
    # Also disconnect broker session
    session = get_user_session(req.user_id)
    if session:
        delete_user_session(req.user_id)
    
    stopped = _stop_user_bot(req.user_id)
    if stopped:
        return {"status": f"Bot stopped and session disconnected for {req.user_id}"}
    return {"info": f"No running bot found for {req.user_id}, session disconnected if existed"}


# ── Admin: Disapprove / Block user ────────────────────────────

@app.post("/admin/disapprove-user")
def admin_disapprove_user(req: AdminActionReq):
    """Block a user: stop their bot and set status='blocked' in Supabase."""
    from supabase_client import supabase_retry
    admin_id = validate_app_session(req.admin_token)
    if not admin_id or not admin_id.startswith("admin:"):
        return {"error": "Unauthorized"}

    # 1. Stop running bot (if any)
    _stop_user_bot(req.user_id)

    # 2. Update Supabase
    try:
        supabase_retry(
            lambda: supabase.table("users").update(
                {"status": "blocked", "bot_running": False}
            ).eq("user_id", req.user_id).execute()
        )
        import session_manager
        session_manager.update_cached_user_status(req.user_id, status="blocked", bot_running=False)
        logging.info(f"[ADMIN] User {req.user_id} blocked.")
        return {"status": f"User {req.user_id} blocked", "bot": "stopped"}
    except Exception as e:
        logging.error(f"[ADMIN] Disapprove error for {req.user_id}: {e}")
        return {"error": f"Supabase update failed: {e}"}

@app.delete("/admin/delete-user")
def admin_delete_user(req: AdminActionReq):
    """Permanently delete a user: stop their bot and remove from Supabase."""
    from supabase_client import supabase_retry
    admin_id = validate_app_session(req.admin_token)
    if not admin_id or not admin_id.startswith("admin:"):
        return {"error": "Unauthorized"}

    # 1. Stop running bot (if any)
    _stop_user_bot(req.user_id)

    # 2. Delete from Supabase
    try:
        supabase_retry(
            lambda: supabase.table("users").delete().eq("user_id", req.user_id).execute()
        )
        import session_manager
        with session_manager.user_status_lock:
            session_manager.USER_STATUS_CACHE.pop(req.user_id, None)
        logging.info(f"[ADMIN] User {req.user_id} deleted.")
        return {"status": f"User {req.user_id} deleted successfully"}
    except Exception as e:
        logging.error(f"[ADMIN] Delete error for {req.user_id}: {e}")
        return {"error": f"Supabase delete failed: {e}"}


# ── Admin: Error logs per user ────────────────────────────────

@app.get("/admin/user-errors")
def admin_user_errors(
    admin_token: str,
    user_id: str,
    limit: int = 100,
    offset: int = 0,
):
    """
    Return the latest errors for a specific user, newest first.
    Optional query params: limit (default 100) and offset (default 0)
    for cursor-style pagination.
    """
    from supabase_client import supabase_retry
    admin_id = validate_app_session(admin_token)
    if not admin_id or not admin_id.startswith("admin:"):
        return {"error": "Unauthorized"}

    try:
        res = supabase_retry(
            lambda: (
                supabase.table("user_errors")
                .select("id, error_type, error_message, severity, raw_response, created_at")
                .eq("user_id", user_id)
                .order("created_at", desc=True)
                .range(offset, offset + limit - 1)
                .execute()
            )
        )
        return {
            "user_id": user_id,
            "total":   len(res.data) if res and res.data else 0,
            "offset":  offset,
            "limit":   limit,
            "errors":  res.data if res and res.data else [],
        }
    except Exception as e:
        logging.error(f"[ADMIN] user-errors fetch failed for {user_id}: {e}")
        return {"error": str(e)}


# ── Admin: Strategy Trades ───────────────────────────────────

@app.get("/admin/strategy-trades")
def admin_strategy_trades(
    admin_token: str,
    user_id: str,
    limit: int = 200,
    offset: int = 0,
):
    """
    Return all strategy signals for a specific user.
    """
    admin_id = validate_app_session(admin_token)
    if not admin_id or not admin_id.startswith("admin:"):
        return {"error": "Unauthorized"}

    try:
        query = (
            supabase.table("strategy_trades")
            .select("id, symbol, side, qty, entry_price, sl, target, created_at")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
        )
        res = query.range(offset, offset + limit - 1).execute()
        return {
            "user_id": user_id,
            "total":   len(res.data),
            "offset":  offset,
            "limit":   limit,
            "trades":  res.data,
        }
    except Exception as e:
        logging.error(f"[ADMIN] strategy-trades fetch failed for {user_id}: {e}")
        return {"error": str(e)}


# ── Admin: Broker Trades (Real Executions) ───────────────────

@app.get("/admin/broker-trades")
def admin_broker_trades(
    admin_token: str,
    user_id: str,
    status: str | None = None,   # optional filter: OPEN / CLOSED
    limit: int = 200,
    offset: int = 0,
):
    """
    Return all real executed broker trades for a specific user.
    """
    admin_id = validate_app_session(admin_token)
    if not admin_id or not admin_id.startswith("admin:"):
        return {"error": "Unauthorized"}

    try:
        query = (
            supabase.table("broker_trades")
            .select(
                "id, strategy_trade_id, symbol, side, qty, executed_price, exit_price, "
                "sl, target, status, broker_order_id, created_at, closed_at"
            )
            .eq("user_id", user_id)
            .order("created_at", desc=True)
        )

        if status and status.upper() in ("OPEN", "CLOSED"):
            query = query.eq("status", status.upper())

        res = query.range(offset, offset + limit - 1).execute()
        return {
            "user_id": user_id,
            "total":   len(res.data),
            "offset":  offset,
            "limit":   limit,
            "trades":  res.data,
        }
    except Exception as e:
        logging.error(f"[ADMIN] broker-trades fetch failed for {user_id}: {e}")
        return {"error": str(e)}


# ── Admin: Instrument Status ────────────────────────────────────

@app.get("/admin/instrument-status")
def admin_instrument_status(admin_token: str):
    """
    Return the status of the instrument master data.
    """
    admin_id = validate_app_session(admin_token)
    if not admin_id or not admin_id.startswith("admin:"):
        return {"error": "Unauthorized"}
        
    from order_manager import get_instrument_status
    return get_instrument_status()


# ──────────────────────────────────────────────────────────────
# Startup Event: Instrument Validation & Background Scheduler
# ──────────────────────────────────────────────────────────────

def _daily_instrument_scheduler():
    """
    Background thread that runs forever, waking up periodically to check
    if it's time (08:00 AM IST) to refresh instruments.
    """
    import time
    from order_manager import IST, build_instrument_map
    import datetime

    logging.info("[SCHEDULER] Daily instrument refresh scheduler started.")
    while True:
        try:
            now = datetime.datetime.now(IST)
            # Run at 08:00 AM IST
            if now.hour == 8 and now.minute == 0:
                build_instrument_map(force=True)
        except Exception as exc:
            logging.error(f"[SCHEDULER] Error in daily scheduler loop: {exc}")
        
        # Sleep for 30 seconds
        time.sleep(30)


def validate_active_sessions_startup():
    """
    Validate session integrity for all users who have bot_running = True.
    """
    from supabase_client import supabase_retry
    logging.info("[SESSION VALIDATION] Checking active bot user sessions...")
    try:
        users_res = supabase_retry(
            lambda: supabase.table("users").select("user_id").eq("bot_running", True).execute()
        )
        if users_res and users_res.data:
            for u in users_res.data:
                uid = u["user_id"]
                try:
                    sess_res = supabase_retry(
                        lambda uid=uid: supabase.table("broker_sessions")
                        .select("api_key, access_token, client_id, is_active")
                        .eq("user_id", uid)
                        .execute()
                    )
                except Exception:
                    sess_res = None
                if not sess_res or not sess_res.data:
                    logging.warning(f"[SESSION INVALID]\nuser={uid}\nreason=missing_broker_session_record")
                    try:
                        supabase_retry(
                            lambda: supabase.table("users").update({"bot_running": False}).eq("user_id", uid).execute()
                        )
                    except Exception:
                        pass
                    continue
                sess = sess_res.data[0]
                reasons = []
                if not sess.get("is_active"):
                    reasons.append("session_inactive")
                if not sess.get("access_token"):
                    reasons.append("missing_access_token")
                if not sess.get("api_key"):
                    reasons.append("missing_api_key")
                if not sess.get("client_id"):
                    reasons.append("missing_client_id")
                
                if reasons:
                    reason_str = ",".join(reasons)
                    logging.warning(f"[SESSION INVALID]\nuser={uid}\nreason={reason_str}")
                    try:
                        supabase_retry(
                            lambda: supabase.table("users").update({"bot_running": False}).eq("user_id", uid).execute()
                        )
                    except Exception:
                        pass
                else:
                    logging.info(f"[SESSION VALID]\nuser={uid}")
        else:
            logging.info("[SESSION VALIDATION] No users with bot_running=True found.")
    except Exception as exc:
        logging.error(f"[SESSION VALIDATION] Error during startup validation: {exc}")


@app.on_event("startup")
def startup_event():
    # Validate active sessions
    validate_active_sessions_startup()

    logging.info("[STARTUP] Building instrument map from Tradejini API...")
    from order_manager import build_instrument_map
    build_instrument_map(force=True)

    # 2. Start the daily scheduler thread
    scheduler_thread = threading.Thread(target=_daily_instrument_scheduler, daemon=True)
    scheduler_thread.start()

    # 3. Start the Central Market Data Engine
    from data_fetcher import start_market_data_engine
    start_market_data_engine()

