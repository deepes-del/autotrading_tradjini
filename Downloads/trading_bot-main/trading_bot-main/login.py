"""
login.py  –  DEPRECATED.

Angel One login has been fully removed.
Use tradejini_login.login_tradejini() instead.

This stub exists only to prevent import errors in any legacy reference.
"""

def login(*args, **kwargs):
    raise NotImplementedError(
        "login.py is deprecated. "
        "Call tradejini_login.login_tradejini(client_id, password, totp_secret) instead."
    )