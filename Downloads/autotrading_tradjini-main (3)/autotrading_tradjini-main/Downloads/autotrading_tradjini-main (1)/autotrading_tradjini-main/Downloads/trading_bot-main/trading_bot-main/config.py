import pytz

# ─────────────────────────────────────────────────────────────
# Tradejini (CubePlus) Platform Configuration
#
# API_KEY has been removed.  The platform now uses a BYOK model:
# every user supplies their own Tradejini API key when they
# connect their broker via the /connect-broker endpoint.
# That key is stored per-user in broker_sessions.api_key and
# used exclusively for that user's requests.
# ─────────────────────────────────────────────────────────────

INDEX              = "NIFTY"
LOT_SIZE           = 65
MAX_TRADES_PER_DAY = 5
TIMEZONE           = pytz.timezone('Asia/Kolkata')
