import re
import secrets
import logging
from datetime import datetime, timedelta, timezone
from supabase_client import supabase


def generate_user_id(name: str, phone: str) -> str:
    # First 4 letters of name (remove spaces, uppercase)
    clean_name = re.sub(r'\s+', '', name).upper()
    name_part = clean_name[:4].ljust(4, 'X')
    
    # First 4 digits of phone
    clean_phone = re.sub(r'\D', '', phone)
    phone_part = clean_phone[:4].ljust(4, '0')
    
    # 2 random digits
    import random
    random_part = f"{random.randint(0, 99):02d}"
    
    return f"{name_part}{phone_part}{random_part}"


def create_app_session(user_id: str, days_valid: int = 30) -> str | None:
    """
    Generate a secure session token and store it in Supabase.
    """
    try:
        session_token = secrets.token_hex(32)
        expires_at = (datetime.now() + timedelta(days=days_valid)).isoformat()
        
        supabase.table("app_sessions").insert({
            "session_token": session_token,
            "user_id": user_id,
            "expires_at": expires_at,
            "is_active": True
        }).execute()
        
        logging.info(f"[SESSION] Created persistent session for {user_id}")
        return session_token
    except Exception as e:
        logging.error(f"[AUTH] Failed to create session: {e}")
        return None


def validate_app_session(session_token: str) -> str | None:
    """
    Check if a session_token is valid and return the associated user_id.
    """
    if not session_token:
        return None
        
    try:
        res = supabase.table("app_sessions").select("user_id, expires_at, is_active").eq("session_token", session_token).eq("is_active", True).execute()
        
        if not res.data:
            return None
            
        session = res.data[0]
        
        # Check expiry
        if session.get("expires_at"):
            expiry = datetime.fromisoformat(session["expires_at"].replace('Z', '+00:00'))
            if datetime.now().astimezone() > expiry.astimezone():
                logging.warning(f"[AUTH] Session expired for token ending in ...{session_token[-4:]}")
                return None
                
        return session["user_id"]
    except Exception as e:
        logging.error(f"[AUTH] Session validation error: {e}")
        return None


def deactivate_app_session(session_token: str):
    """
    Mark a session as inactive (Logout).
    """
    try:
        supabase.table("app_sessions").update({"is_active": False}).eq("session_token", session_token).execute()
        logging.info(f"[SESSION] Deactivated token ending in ...{session_token[-4:]}")
    except Exception as e:
        logging.error(f"[AUTH] Deactivation error: {e}")


def register_user(name, age, occupation, phone, password, api_key: str = None, client_id: str = None, totp_secret: str = None):
    """
    Registers a new user AND atomically saves broker credentials into broker_configs.
    Both must succeed — if broker config insert fails, user record is deleted.
    """
    print("=" * 60)
    print("[REGISTER] ========== REGISTER START ==========")
    print(f"[REGISTER] name={name!r}, phone={phone!r}")
    print(f"[REGISTER] api_key present={bool(api_key)}, client_id present={bool(client_id)}, totp_secret present={bool(totp_secret)}")
    print(f"[REGISTER] api_key={repr(api_key[:6] + '...' if api_key and len(api_key) > 6 else api_key)}")
    print(f"[REGISTER] client_id={repr(client_id)}")
    print("=" * 60)

    if not (api_key and client_id and totp_secret):
        print(f"[REGISTER] ❌ GUARD FAILED — missing broker fields: api_key={bool(api_key)}, client_id={bool(client_id)}, totp_secret={bool(totp_secret)}")
        return {"error": "Broker credentials (API Key, Client ID, TOTP Secret) are required to register."}

    print("[REGISTER] ✅ Guard passed — all broker fields present")

    try:
        print(f"[REGISTER] Checking if phone {phone!r} already exists...")
        existing = supabase.table("users").select("*").eq("phone", phone).execute()
        if existing.data:
            print(f"[REGISTER] ❌ Phone already registered")
            return {"error": "Phone number already registered"}

        user_id = generate_user_id(name, phone)
        print(f"[REGISTER] Generated user_id={user_id!r}")

        while True:
            check_id = supabase.table("users").select("*").eq("user_id", user_id).execute()
            if not check_id.data:
                break
            user_id = generate_user_id(name, phone)
            print(f"[REGISTER] Collision — regenerated user_id={user_id!r}")

        # ── Step 1: Create user account ────────────────────────────────
        print(f"[REGISTER] STEP 1 — Inserting user {user_id!r} into users table...")
        user_data = {
            "user_id": user_id,
            "name": name,
            "age": age,
            "occupation": occupation,
            "phone": phone,
            "password": password,
            "status": "pending",
            "bot_running": False
        }
        user_res = supabase.table("users").insert(user_data).execute()
        print(f"[REGISTER] STEP 1 RESULT — users insert response: {user_res.data}")
        logging.info(f"[AUTH] User {user_id} created successfully.")

        # ── Step 2: Save broker credentials atomically ─────────────────
        print(f"[REGISTER] STEP 2 — Inserting broker_configs for {user_id!r}...")
        try:
            broker_data = {
                "user_id":     user_id,
                "broker_name": "tradejini",
                "api_key":     api_key.strip(),
                "client_id":   client_id.strip().upper(),
                "totp_secret": totp_secret.strip(),
                "updated_at":  datetime.now(timezone.utc).isoformat()
            }
            print(f"[REGISTER] broker_data keys: {list(broker_data.keys())}")
            print(f"[REGISTER] broker_data user_id={broker_data['user_id']!r}, broker_name={broker_data['broker_name']!r}, client_id={broker_data['client_id']!r}")
            broker_res = supabase.table("broker_configs").upsert(broker_data, on_conflict="user_id").execute()
            print(f"[REGISTER] STEP 2 RESULT — broker_configs upsert response: {broker_res.data}")
            logging.info(f"[AUTH] Broker config saved for {user_id} during registration.")
            print(f"[REGISTER] ✅ SUCCESS — user created + broker config saved for {user_id!r}")
        except Exception as broker_err:
            # Rollback: delete the user we just created
            print(f"[REGISTER] ❌ STEP 2 FAILED — broker_configs upsert error: {broker_err!r}")
            print(f"[REGISTER] ❌ broker_err type: {type(broker_err).__name__}")
            logging.error(f"[AUTH] Broker config save failed for {user_id}: {broker_err}. Rolling back user creation.")
            try:
                supabase.table("users").delete().eq("user_id", user_id).execute()
                print(f"[REGISTER] Rollback complete — user {user_id!r} deleted")
            except Exception as del_err:
                print(f"[REGISTER] ❌ Rollback FAILED — orphan user {user_id!r} may exist: {del_err!r}")
                logging.error(f"[AUTH] Rollback failed — orphan user {user_id} may exist: {del_err}")
            return {"error": f"Registration failed: Could not save broker credentials. Please try again."}

        return {"status": "registered", "user_id": user_id}

    except Exception as e:
        print(f"[REGISTER] ❌ OUTER EXCEPTION: {e!r}")
        print(f"[REGISTER] ❌ Exception type: {type(e).__name__}")
        logging.error(f"[AUTH] Registration fatal error: {str(e)}")
        return {"error": f"Registration failed: {str(e)}"}

        return {"error": "Broker credentials (API Key, Client ID, TOTP Secret) are required to register."}

    try:
        existing = supabase.table("users").select("*").eq("phone", phone).execute()
        if existing.data:
            return {"error": "Phone number already registered"}

        user_id = generate_user_id(name, phone)
        
        while True:
            check_id = supabase.table("users").select("*").eq("user_id", user_id).execute()
            if not check_id.data:
                break
            user_id = generate_user_id(name, phone)

        # ── Step 1: Create user account ────────────────────────────────
        user_data = {
            "user_id": user_id,
            "name": name,
            "age": age,
            "occupation": occupation,
            "phone": phone,
            "password": password,
            "status": "pending",
            "bot_running": False
        }
        supabase.table("users").insert(user_data).execute()
        logging.info(f"[AUTH] User {user_id} created successfully.")

        # ── Step 2: Save broker credentials atomically ─────────────────
        try:
            broker_data = {
                "user_id":     user_id,
                "broker_name": "tradejini",
                "api_key":     api_key.strip(),
                "client_id":   client_id.strip().upper(),
                "totp_secret": totp_secret.strip(),
                "updated_at":  datetime.now(timezone.utc).isoformat()
            }
            supabase.table("broker_configs").upsert(broker_data, on_conflict="user_id").execute()
            logging.info(f"[AUTH] Broker config saved for {user_id} during registration.")
        except Exception as broker_err:
            # Rollback: delete the user we just created
            logging.error(f"[AUTH] Broker config save failed for {user_id}: {broker_err}. Rolling back user creation.")
            try:
                supabase.table("users").delete().eq("user_id", user_id).execute()
            except Exception as del_err:
                logging.error(f"[AUTH] Rollback failed — orphan user {user_id} may exist: {del_err}")
            return {"error": f"Registration failed: Could not save broker credentials. Please try again."}

        return {"status": "registered", "user_id": user_id}
        
    except Exception as e:
        logging.error(f"[AUTH] Registration fatal error: {str(e)}")
        return {"error": f"Registration failed: {str(e)}"}


def login_user(user_id, password):
    """
    Verifies user credentials against the Supabase 'users' table.
    """
    try:
        res = supabase.table("users").select("*").eq("user_id", user_id).execute()

        if not res.data:
            return None

        user = res.data[0]

        if password == user["password"]:
            return user
        else:
            return None
            
    except Exception as e:
        import logging
        logging.error(f"Login error: {e}")
        return None
