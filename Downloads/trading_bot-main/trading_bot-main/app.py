"""
app.py  –  FastAPI backend for the Tradejini multi-user trading platform.
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from fastapi.responses import FileResponse
from auth import register_user, login_user
from tradejini_login import login_tradejini
from session_manager import store_session, get_session, has_session, set_active
import os
import logging
import threading
from supabase_client import supabase

# Suppress noisy access logs for the /logs polling endpoint
logging.getLogger("uvicorn.access").setLevel(logging.WARNING)

app = FastAPI()

# Platform session store: session_token -> {user_id, name}
active_sessions: dict = {}
admin_sessions: set = set()

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

@app.post("/register")
def register(req: RegisterRequest):
    return register_user(req.name, req.age, req.occupation, req.phone, req.password)


class LoginRequest(BaseModel):
    user_id: str
    password: str

@app.post("/login")
def login(req: LoginRequest):
    user = login_user(req.user_id, req.password)

    if user:
        session_token = user["user_id"]   # simple token: user_id as session key
        active_sessions[session_token] = {
            "user_id": user["user_id"],
            "name": user["name"],
        }
        return {"status": "success", "session_token": session_token}

    return {"error": "Invalid credentials"}


# ──────────────────────────────────────────────────────────────
# Broker connection  (Tradejini)
# ──────────────────────────────────────────────────────────────

class BrokerCredentials(BaseModel):
    session_token: str
    client_id: str
    password: str       # Trading PIN
    totp_secret: str    # TOTP secret — backend only, never logged


@app.post("/connect-broker")
def connect_broker(creds: BrokerCredentials):
    """
    1. Validate platform session.
    2. Call Tradejini login API (backend-managed).
    3. Store the returned access_token in session_manager.
    """
    if creds.session_token not in active_sessions:
        return {"error": "Invalid platform session. Please log in first."}

    user_id = active_sessions[creds.session_token]["user_id"]
    print(f"[BROKER] Connect request for user: {user_id} | client: {creds.client_id}")

    token, err_msg = login_tradejini(creds.client_id, creds.password, creds.totp_secret)

    if not token:
        return {"error": f"Tradejini login failed: {err_msg}"}

    store_session(user_id, creds.client_id, token)
    return {"status": "Broker connected successfully", "user_id": user_id}


# ──────────────────────────────────────────────────────────────
# Bot control
# ──────────────────────────────────────────────────────────────

def update_bot_status(user_id: str, is_running: bool):
    try:
        supabase.table("users").update({"bot_running": is_running}).eq("user_id", user_id).execute()
    except Exception as e:
        logging.error(f"Error updating bot status: {e}")

class BotConfig(BaseModel):
    session_token: str
    mode: str = "default"
    sl: int = 10
    target: int = 20
    index: str = "NIFTY"
    lots: int = 1

@app.post("/start-bot")
def start_bot_api(config: BotConfig):
    from main import start_bot

    if config.session_token not in active_sessions:
        return {"error": "Invalid platform session"}

    user_id = active_sessions[config.session_token]["user_id"]
    
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
        "mode": config.mode,
        "sl": config.sl,
        "target": config.target,
        "index": config.index,
        "lots": config.lots,
        "is_running": True,
        "stop_requested": False,
    }

    started = start_bot(user_id, user_config)

    if started:
        set_active(user_id, True)
        update_bot_status(user_id, True)
        return {"status": "Bot started", "user_id": user_id}
    else:
        return {"error": "Bot is already running for this user"}


class StopBotRequest(BaseModel):
    session_token: str

@app.post("/stop-bot")
def stop_bot_api(req: StopBotRequest):
    from main import running_bots

    if req.session_token not in active_sessions:
        return {"error": "Invalid platform session"}

    user_id = active_sessions[req.session_token]["user_id"]

    if user_id in running_bots:
        running_bots[user_id]["config"]["stop_requested"] = True
        set_active(user_id, False)
        update_bot_status(user_id, False)
        return {"status": "Stop signal sent"}

    return {"error": "No running bot found for this user"}


# ──────────────────────────────────────────────────────────────
# Log streaming
# ──────────────────────────────────────────────────────────────

@app.get("/logs")
def get_logs(session_token: str):
    from main import user_logs

    if session_token not in active_sessions:
        return {"error": "Invalid platform session"}

    user_id = active_sessions[session_token]["user_id"]
    return {"logs": user_logs.get(user_id, [])}


# ──────────────────────────────────────────────────────────────
# Admin API
# ──────────────────────────────────────────────────────────────

class AdminLoginReq(BaseModel):
    username: str
    password: str

@app.post("/admin/login")
def admin_login(req: AdminLoginReq):
    try:
        res = supabase.table("admin").select("*").eq("username", req.username).execute()
        if res.data and res.data[0]["password"] == req.password:
            admin_token = f"admin_{req.username}"
            admin_sessions.add(admin_token)
            return {"status": "success", "admin_token": admin_token}
    except Exception as e:
        logging.error(f"Admin login error: {e}")
    return {"error": "Invalid admin credentials"}

class AdminActionReq(BaseModel):
    admin_token: str
    user_id: str

@app.get("/admin/dashboard")
def admin_dashboard(admin_token: str):
    if admin_token not in admin_sessions:
        return {"error": "Unauthorized"}
    try:
        res = supabase.table("users").select("user_id, name, phone, status, bot_running, created_at").execute()
        return {"users": res.data}
    except Exception as e:
        return {"error": str(e)}

@app.post("/admin/approve")
def admin_approve(req: AdminActionReq):
    if req.admin_token not in admin_sessions:
        return {"error": "Unauthorized"}
    try:
        supabase.table("users").update({"status": "approved"}).eq("user_id", req.user_id).execute()
        return {"status": f"User {req.user_id} approved"}
    except Exception as e:
        return {"error": str(e)}

@app.post("/admin/start-bot")
def admin_start_bot(req: AdminActionReq):
    if req.admin_token not in admin_sessions:
        return {"error": "Unauthorized"}
    
    from main import start_bot
    if not has_session(req.user_id):
        return {"error": "Broker not connected for this user"}

    user_config = {
        "user_id": req.user_id,
        "mode": "default",
        "sl": 10,
        "target": 20,
        "index": "NIFTY",
        "lots": 1,
        "is_running": True,
        "stop_requested": False,
    }

    started = start_bot(req.user_id, user_config)
    if started:
        set_active(req.user_id, True)
        update_bot_status(req.user_id, True)
        return {"status": f"Bot started for {req.user_id}"}
    return {"error": "Bot already running"}


# ── Admin helpers ──────────────────────────────────────────

def _stop_user_bot(user_id: str) -> bool:
    """
    Signal the bot thread to stop and sync state to Supabase.
    Returns True if a running bot was found and signalled.
    Thread-safe: only sets a flag; the thread exits on its own loop iteration.
    """
    from main import running_bots
    bot = running_bots.get(user_id)
    if bot:
        bot["config"]["stop_requested"] = True
        set_active(user_id, False)
        try:
            supabase.table("users").update({"bot_running": False}).eq("user_id", user_id).execute()
        except Exception as e:
            logging.error(f"[ADMIN] Supabase update failed on stop-bot for {user_id}: {e}")
        logging.info(f"[ADMIN] Stop signal sent to bot for user {user_id}")
        return True
    # Bot not running — still ensure DB is consistent
    try:
        supabase.table("users").update({"bot_running": False}).eq("user_id", user_id).execute()
    except Exception:
        pass
    return False


@app.post("/admin/stop-bot")
def admin_stop_bot(req: AdminActionReq):
    if req.admin_token not in admin_sessions:
        return {"error": "Unauthorized"}
    stopped = _stop_user_bot(req.user_id)
    if stopped:
        return {"status": f"Bot stopped for {req.user_id}"}
    return {"info": f"No running bot found for {req.user_id}"}


# ── Admin: Disapprove / Block user ────────────────────────────

@app.post("/admin/disapprove-user")
def admin_disapprove_user(req: AdminActionReq):
    """Block a user: stop their bot and set status='blocked' in Supabase."""
    if req.admin_token not in admin_sessions:
        return {"error": "Unauthorized"}

    # 1. Stop running bot (if any)
    _stop_user_bot(req.user_id)

    # 2. Update Supabase
    try:
        supabase.table("users").update(
            {"status": "blocked", "bot_running": False}
        ).eq("user_id", req.user_id).execute()
        logging.info(f"[ADMIN] User {req.user_id} blocked.")
        return {"status": f"User {req.user_id} blocked", "bot": "stopped"}
    except Exception as e:
        logging.error(f"[ADMIN] Disapprove error for {req.user_id}: {e}")
        return {"error": f"Supabase update failed: {e}"}

@app.delete("/admin/delete-user")
def admin_delete_user(req: AdminActionReq):
    """Permanently delete a user: stop their bot and remove from Supabase."""
    if req.admin_token not in admin_sessions:
        return {"error": "Unauthorized"}

    # 1. Stop running bot (if any)
    _stop_user_bot(req.user_id)

    # 2. Delete from Supabase
    try:
        supabase.table("users").delete().eq("user_id", req.user_id).execute()
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
    if admin_token not in admin_sessions:
        return {"error": "Unauthorized"}

    try:
        res = (
            supabase.table("user_errors")
            .select("id, error_type, error_message, severity, raw_response, created_at")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
        return {
            "user_id": user_id,
            "total":   len(res.data),
            "offset":  offset,
            "limit":   limit,
            "errors":  res.data,
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
    if admin_token not in admin_sessions:
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
    if admin_token not in admin_sessions:
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
