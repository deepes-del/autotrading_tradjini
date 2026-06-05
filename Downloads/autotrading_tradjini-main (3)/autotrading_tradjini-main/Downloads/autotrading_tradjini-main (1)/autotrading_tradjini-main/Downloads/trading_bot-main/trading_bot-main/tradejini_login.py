"""
tradejini_login.py
------------------
Hardened Tradejini (CubePlus) broker authentication — BYOK model.

Each user provides their own Tradejini API key.  The key is passed in
as a parameter and NEVER read from a global config file.

SAFETY RULES:
  - client_id normalized to UPPERCASE + stripped.
  - password (Trading PIN) whitespace trimmed.
  - TOTP generated immediately before the HTTP request (never cached).
  - ONE attempt only.  No retries.  Repeated wrong credentials block the account.
  - Success = access_token present in response.
  - Block phrases detected and returned with is_blocked=True.

Endpoint:
    POST https://api.tradejini.com/v2/api-gw/oauth/individual-token-v2

Auth header (login only):
    Authorization: Bearer <USER_API_KEY>   ← user's own API key

Payload (application/x-www-form-urlencoded):
    userId   – Tradejini client ID  (UPPERCASE)
    password – Trading PIN
    twoFa    – Live TOTP (generated server-side immediately before call)
    twoFaTyp – "totp"
"""

import requests
import pyotp
import logging

BASE_URL       = "https://api.tradejini.com/v2"
LOGIN_ENDPOINT = "/api-gw/oauth/individual-token-v2"

_BLOCK_PHRASES = (
    "blocked",
    "incorrect attempts",
    "account locked",
    "too many attempts",
    "maximum attempts",
)


def _is_block_error(message: str) -> bool:
    msg_lower = (message or "").lower()
    return any(phrase in msg_lower for phrase in _BLOCK_PHRASES)


def _extract_error_msg(response: requests.Response) -> str:
    try:
        data = response.json()
        return (
            data.get("msg")
            or data.get("message")
            or data.get("error_description")
            or data.get("errmsg")
            or response.text
        )
    except Exception:
        return response.text


def _mask(value: str) -> str:
    """Mask sensitive string for logging: show first 4 and last 4 chars only."""
    if not value or len(value) < 9:
        return "****"
    return f"{value[:4]}{'*' * (len(value) - 8)}{value[-4:]}"


def login_tradejini(
    api_key: str,
    client_id: str,
    password: str,
    totp_secret: str,
) -> tuple[str | None, str | None, bool]:
    """
    Authenticate a single user with Tradejini using their own API key.

    Parameters
    ----------
    api_key     : User's own Tradejini developer API key
    client_id   : Tradejini client / user ID
    password    : Trading PIN
    totp_secret : Base32 TOTP secret from the user's authenticator app

    Returns
    -------
    (access_token, error_message, is_blocked)
      - On success : (token,  None,  False)
      - On block   : (None,   msg,   True)
      - On failure : (None,   msg,   False)
    """

    # ── 1. Normalize & sanitize ───────────────────────────────────────────────
    api_key   = api_key.strip()
    client_id = client_id.strip().upper()
    password  = password.strip()

    if not api_key:
        return None, "API key is missing. Please enter your Tradejini API key.", False

    url = BASE_URL + LOGIN_ENDPOINT
    headers = {
        # BYOK: each user's own API key in the auth header
        "Authorization": f"Bearer {api_key}",
        "Content-Type":  "application/x-www-form-urlencoded",
    }

    logging.info(
        f"[BROKER_LOGIN_ATTEMPT] client={client_id} | "
        f"api_key={_mask(api_key)}"
    )

    # ── 2. ONE attempt only — no retries ─────────────────────────────────────
    try:
        totp = pyotp.TOTP(totp_secret).now()
        logging.info(f"[TOTP_GENERATED] client={client_id} | (value not logged)")

        payload = {
            "userId":   client_id,
            "password": password,   # Trading PIN — not logged
            "twoFa":    totp,       # TOTP — fresh, not logged
            "twoFaTyp": "totp",
        }

        response = requests.post(url, headers=headers, data=payload, timeout=15)

        logging.info(
            f"[BROKER_LOGIN_ATTEMPT] client={client_id} | "
            f"http_status={response.status_code}"
        )

        # ── 3. Parse response ─────────────────────────────────────────────────
        if response.ok:
            try:
                data = response.json()
            except Exception:
                logging.error(
                    f"[BROKER_LOGIN_FAILED] client={client_id} | non-JSON body"
                )
                return None, "Broker returned a non-JSON response", False

            # PRIMARY SUCCESS: access_token present
            data_dict = data.get("data") if isinstance(data.get("data"), dict) else {}
            token = (
                data.get("access_token")
                or data.get("accessToken")
                or data.get("token")
                or data_dict.get("access_token")
                or data_dict.get("accessToken")
                or data_dict.get("token")
            )

            if token:
                logging.info(
                    f"[BROKER_LOGIN_SUCCESS] client={client_id} | "
                    f"token_type={data.get('token_type', 'Bearer')} | "
                    f"expires_in={data.get('expires_in', 'unknown')}s"
                )
                return token, None, False

            # No token — extract reason
            raw_msg = (
                data.get("msg")
                or data.get("message")
                or data.get("error_description")
                or str(data)
            )

            if _is_block_error(raw_msg):
                logging.critical(
                    f"[LOGIN_BLOCKED] client={client_id} | reason={raw_msg}"
                )
                return None, f"Account temporarily blocked: {raw_msg}", True

            logging.error(
                f"[BROKER_LOGIN_FAILED] client={client_id} | "
                f"no access_token | reason={raw_msg}"
            )
            return None, f"Broker returned no token: {raw_msg}", False

        else:
            err_msg = _extract_error_msg(response)

            if _is_block_error(err_msg):
                logging.critical(
                    f"[LOGIN_BLOCKED] client={client_id} | "
                    f"http={response.status_code} | reason={err_msg}"
                )
                return None, f"Account temporarily blocked: {err_msg}", True

            logging.error(
                f"[BROKER_LOGIN_FAILED] client={client_id} | "
                f"http={response.status_code} | reason={err_msg}"
            )
            return None, f"Broker rejected login (HTTP {response.status_code}): {err_msg}", False

    except requests.exceptions.Timeout:
        logging.error(f"[BROKER_LOGIN_FAILED] client={client_id} | timeout")
        return None, "Login request timed out. Please try again.", False

    except Exception as exc:
        logging.error(f"[BROKER_LOGIN_FAILED] client={client_id} | exception={exc}")
        return None, f"System error during login: {str(exc)}", False
