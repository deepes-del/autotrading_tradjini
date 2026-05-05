import pytz

# ─────────────────────────────────────────────────────────────
# Tradejini (CubePlus) API Configuration
# DO NOT add CLIENT_ID / PASSWORD / TOTP_SECRET here.
# All user credentials are supplied at runtime via /connect-broker.
# ─────────────────────────────────────────────────────────────

API_KEY = "71c4eae8b700e4e11028252e59ae505d"   # Replace with your actual Tradejini API key

INDEX = "NIFTY"
LOT_SIZE = 65
MAX_TRADES_PER_DAY = 5
TIMEZONE = pytz.timezone('Asia/Kolkata')
