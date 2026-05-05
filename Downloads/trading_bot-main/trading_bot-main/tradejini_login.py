"""
tradejini_login.py
------------------
Tradejini (CubePlus) broker authentication.

Verified Endpoint:
    POST https://api.tradejini.com/api-gw/oauth/individual-token-v2

Auth header (login only):
    Authorization: Bearer <API_KEY>        ← API key alone, no access_token yet

Payload (application/x-www-form-urlencoded):
    password    – Trading PIN
    twoFa       – Live TOTP (generated server-side)
    twoFaTyp    – "totp"
    NOTE: client_id is NOT included in payload — it is part of the API_KEY context.

Returns: access_token string on success, None on failure.
"""

import requests
import pyotp
import logging
import config

BASE_URL      = "https://api.tradejini.com/v2"
LOGIN_ENDPOINT = "/api-gw/oauth/individual-token-v2"


def login_tradejini(client_id: str, password: str, totp_secret: str) -> str | None:
    """
    Authenticate a single user with Tradejini.

    Parameters
    ----------
    client_id   : Tradejini client / user ID
    password    : Trading PIN
    totp_secret : Base32 TOTP secret from the user's authenticator app

    Returns
    -------
    str  – access_token on success
    None – on any failure
    """
    try:
        totp = pyotp.TOTP(totp_secret).now()
        print(f"[LOGIN] Attempting Tradejini login for client: {client_id}")

        url = BASE_URL + LOGIN_ENDPOINT

        # Login uses ONLY the API key — no access_token exists yet
        headers = {
            "Authorization": f"Bearer {config.API_KEY}",
            "Content-Type": "application/x-www-form-urlencoded",
        }
        # client_id is NOT sent in payload — Tradejini identifies user via API key context
        payload = {
            "password": password,    # Trading PIN — not logged
            "twoFa":    totp,        # TOTP — not logged
            "twoFaTyp": "totp",
        }

        response = requests.post(url, headers=headers, data=payload, timeout=15)

        print(f"[LOGIN] STATUS:   {response.status_code}")
        # Avoid printing full response — may contain access_token
        safe_body = response.text if response.status_code != 200 else "[RESPONSE HIDDEN — contains token]"
        print(f"[LOGIN] RESPONSE: {safe_body}")

        if response.status_code == 200:
            if not response.text:
                logging.error("[LOGIN] Empty response body.")
                return None
            data  = response.json()
            # Try flat key first, then nested under 'data'
            token = (
                data.get("access_token")
                or data.get("data", {}).get("access_token")
            )
            if token:
                logging.info(f"[LOGIN] Broker login successful for client: {client_id}")
                # DO NOT log the token itself
                return token
            else:
                logging.error(f"[LOGIN] Token missing in response: {data}")
                return None
        else:
            logging.error(
                f"[LOGIN] Failed for {client_id} | "
                f"Status: {response.status_code} | Body: {response.text}"
            )
            return None

    except Exception as e:
        logging.error(f"[LOGIN] Exception during Tradejini login: {e}")
        return None
