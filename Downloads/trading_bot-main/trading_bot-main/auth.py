import random
import re
from supabase_client import supabase


def generate_user_id(name: str, phone: str) -> str:
    # First 4 letters of name (remove spaces, uppercase)
    clean_name = re.sub(r'\s+', '', name).upper()
    name_part = clean_name[:4].ljust(4, 'X')
    
    # First 4 digits of phone
    clean_phone = re.sub(r'\D', '', phone)
    phone_part = clean_phone[:4].ljust(4, '0')
    
    # 2 random digits
    random_part = f"{random.randint(0, 99):02d}"
    
    return f"{name_part}{phone_part}{random_part}"


def register_user(name, age, occupation, phone, password):
    """
    Registers a new user in the Supabase 'users' table.
    Generates a unique user_id based on name and phone.
    """
    # Check if phone exists (since it's UNIQUE in schema)
    try:
        existing = supabase.table("users").select("*").eq("phone", phone).execute()
        if existing.data:
            return {"error": "Phone number already registered"}

        user_id = generate_user_id(name, phone)
        
        # Ensure user_id is unique
        while True:
            check_id = supabase.table("users").select("*").eq("user_id", user_id).execute()
            if not check_id.data:
                break
            user_id = generate_user_id(name, phone)

        data = {
            "user_id": user_id,
            "name": name,
            "age": age,
            "occupation": occupation,
            "phone": phone,
            "password": password,  # Storing as-is
            "status": "pending",
            "bot_running": False
        }

        supabase.table("users").insert(data).execute()
        return {"status": "registered", "user_id": user_id}
        
    except Exception as e:
        import logging
        logging.error(f"Registration error: {e}")
        return {"error": str(e)}


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
