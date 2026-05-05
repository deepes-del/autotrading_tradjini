import pyotp
import requests
import socket
import uuid
import re
import logging
import time
from SmartApi import SmartConnect

# ==========================================
# CONFIGURATION (EDIT THESE)
# ==========================================
API_KEY = "G6g2OmC1"
CLIENT_ID = "AABO475569"
PASSWORD = "7337"
TOTP_SECRET = "JNTZKQNECGIPNZSANQYPEVFQQM"

# SAFETY FLAG: Set to True to actually place the order
ACTUAL_ORDER = True 

# TEST ORDER PARAMETERS
TEST_SYMBOL = "NIFTY21APR2624500PE" # Example Option Symbol
TEST_TOKEN = "70530"               # Example Option Token
TEST_QTY = 1

# ==========================================

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def get_public_ip():
    try:
        return requests.get("https://ifconfig.me", timeout=5).text.strip()
    except:
        return "Couldn't fetch public IP"

def get_local_ip():
    return socket.gethostbyname(socket.gethostname())

def get_mac_address():
    return ':'.join(re.findall('..', '%012x' % uuid.getnode()))

def run_test():
    try:
        # 1. Hardware & Network Info
        public_ip = get_public_ip()
        local_ip = get_local_ip()
        mac = get_mac_address()
        
        print(f"\n--- NETWORK INFO ---")
        print(f"Public IP : {public_ip}")
        print(f"Local IP  : {local_ip}")
        print(f"MAC Addr  : {mac}")
        print(f"--------------------\n")

        # 2. Login
        print("[LOGIN] Initiating...")
        obj = SmartConnect(api_key=API_KEY)
        
        # Spoofing headers before session generation
        obj.clientLocalIp = local_ip
        obj.clientLocalIP = local_ip
        obj.clientPublicIp = public_ip
        obj.clientPublicIP = public_ip
        obj.clientMacAddress = mac
        
        totp = pyotp.TOTP(TOTP_SECRET).now()
        data = obj.generateSession(CLIENT_ID, PASSWORD, totp)

        if not data.get('status'):
            print(f"[LOGIN FAILED] Message: {data.get('message')}")
            return

        print("[LOGIN SUCCESS]")
        
        # 3. Place Test Order
        order_params = {
            "variety": "AMO",
            "tradingsymbol": TEST_SYMBOL,
            "symboltoken": TEST_TOKEN,
            "transactiontype": "BUY",
            "exchange": "NFO",
            "ordertype": "MARKET",
            "producttype": "INTRADAY",
            "duration": "DAY",
            "price": "0",
            "squareoff": "0",
            "stoploss": "0",
            "quantity": int(TEST_QTY),
            "scripconsent": "yes"
        }

        print(f"\n--- ORDER PREVIEW ---")
        for k, v in order_params.items():
            print(f"{k}: {v}")
        print(f"--------------------")

        if ACTUAL_ORDER:
            print("\n[ORDER] Placing actual AMO order...")
            response = obj.placeOrder(order_params)
            
            if response:
                print(f"[ORDER PLACED] Success! Response: {response}")
            else:
                print(f"[ORDER FAILED] Received empty response (b'')")
        else:
            print("\n[SIMULATION] Actual placement skipped. Set ACTUAL_ORDER = True to place.")

    except Exception as e:
        print(f"\n[CRITICAL ERROR] {str(e)}")

if __name__ == "__main__":
    print("=== ANGEL ONE SMARTAPI TEST SCRIPT ===")
    run_test()
    print("\nTest Script Execution Completed.")
