"""
data_fetcher.py  –  Market data via Tradejini (CubePlus) v2 API & yfinance.

Verified Endpoint:
    Candle Data : GET /v2/api/mkt-data/chart/interval-data
    LTP         : Derived from latest candle close (no dedicated REST LTP endpoint)

Auth header:
    Authorization: Bearer <API_KEY>:<access_token>

broker_ctx = {"access_token": str, "client_id": str}
"""

import requests
import pandas as pd
import datetime
import logging
import pytz
import time
import yfinance as yf
import config

BASE_URL = "https://api.tradejini.com/v2"

INTERVAL_MAP = {
    "FIVE_MINUTE": "5",
    "ONE_MINUTE":  "1",
    "15_MINUTE":   "15",
    "ONE_HOUR":    "60",
    "ONE_DAY":     "1D",
}

INDEX_MAP = {
    "NIFTY":     {"yf": "^NSEI",    "token": "99926000"},
    "BANKNIFTY": {"yf": "^NSEBANK", "token": "99926009"},
}

INDEX_YF_MAP = {
    "99926000": "^NSEI",
    "99926009": "^NSEBANK"
}

# Simple cache dictionary to avoid redundant yfinance calls within the same cycle
_yf_cache = {}

def _headers(broker_ctx: dict) -> dict:
    """
    Build per-user auth headers dynamically.
    broker_ctx must contain 'api_key' and 'access_token'.
    """
    return {
        "Authorization": f"Bearer {broker_ctx['api_key']}:{broker_ctx['access_token']}",
        "Content-Type": "application/json",
    }

# ── EMA seed via yfinance (broker-agnostic, logic unchanged) ──

def initialize_hybrid_ema(index_name: str = "NIFTY"):
    logging.info(f"Initializing Hybrid EMA for {index_name} using yfinance...")
    try:
        ticker = INDEX_MAP.get(index_name, INDEX_MAP["NIFTY"])["yf"]
        df = yf.download(ticker, interval="5m", period="5d", progress=False)

        if df.empty:
            logging.error("Failed to download yfinance data.")
            return None

        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)

        df = df[['Open', 'High', 'Low', 'Close', 'Volume']].copy()
        df.columns = ['open', 'high', 'low', 'close', 'volume']

        if df.index.tz is None:
            df.index = df.index.tz_localize('Asia/Kolkata')
        else:
            df.index = df.index.tz_convert('Asia/Kolkata')

        df['timestamp_ist'] = df.index
        ist = pytz.timezone('Asia/Kolkata')
        now = datetime.datetime.now(ist)
        last_ts = df['timestamp_ist'].iloc[-1]

        if now < (last_ts + datetime.timedelta(minutes=5)):
            df = df.iloc[:-1]   # remove still-forming candle

        if df.empty:
            logging.error("No completed 5-minute candles available for EMA seed.")
            return None

        df['EMA5'] = df['close'].ewm(span=5, adjust=False).mean()
        logging.info("EMA5 initialized from yfinance.")
        return df

    except Exception as e:
        logging.error(f"yfinance init error: {e}")
        return None

# ── Live candle refresh ────────────────────────────────────────

def update_hybrid_ema(
    global_df: pd.DataFrame,
    broker_ctx: dict,
    exchange: str,
    symboltoken: str,
    interval: str = "FIVE_MINUTE",
):
    """Fetch latest 5-min candles, append to global_df, update EMA5."""
    ist = pytz.timezone('Asia/Kolkata')
    now = datetime.datetime.now(ist)
    now_ts = int(time.time())

    is_index = symboltoken in INDEX_YF_MAP

    if is_index:
        ticker = INDEX_YF_MAP[symboltoken]
        cache_key = f"{ticker}_5m"
        cached_data = _yf_cache.get(cache_key)
        
        if cached_data and (now_ts - cached_data['ts']) < 5:
            df_new = cached_data['df']
        else:
            try:
                df_new = yf.download(ticker, interval="5m", period="1d", progress=False)
                if df_new.empty:
                    logging.error(f"[DATA ERROR] yfinance empty for {ticker}")
                    return False, global_df
                
                if isinstance(df_new.columns, pd.MultiIndex):
                    df_new.columns = df_new.columns.get_level_values(0)
                    
                df_new = df_new[['Open', 'High', 'Low', 'Close', 'Volume']].copy()
                df_new.columns = ['open', 'high', 'low', 'close', 'volume']
                
                if df_new.index.tz is None:
                    df_new['timestamp_ist'] = df_new.index.tz_localize('Asia/Kolkata')
                else:
                    df_new['timestamp_ist'] = df_new.index.tz_convert('Asia/Kolkata')
                
                # Trim forming candle
                last_ts = df_new['timestamp_ist'].iloc[-1]
                if now < (last_ts + datetime.timedelta(minutes=5)):
                    df_new = df_new.iloc[:-1]
                
                if df_new.empty:
                    return False, global_df
                
                _yf_cache[cache_key] = {'ts': now_ts, 'df': df_new}
            except Exception as e:
                logging.error(f"[DATA EXCEPTION] yfinance {ticker}: {e}")
                return False, global_df
            
    else:
        # Tradejini for options
        from_ts = now_ts - 86400 # Last 24 hours
        symbol_id = symboltoken

        url = f"{BASE_URL}/api/mkt-data/chart/interval-data"
        params = {
            "id": symbol_id, 
            "interval": "5", 
            "from": from_ts, 
            "to": now_ts
        }

        try:
            response = requests.get(url, headers=_headers(broker_ctx), params=params, timeout=10)
            if response.status_code == 200:
                data = response.json()
                if not data or data.get("s") == "no-data":
                    return False, global_df
                
                res_d = data.get("d", {})
                bars = res_d.get("bars", [])
                
                if not bars:
                    return False, global_df
                    
                df_new = pd.DataFrame(bars, columns=['time', 'open', 'high', 'low', 'close', 'volume', 'oi'])
                df_new['timestamp_ist'] = pd.to_datetime(df_new['time'], unit='ms').dt.tz_localize('UTC').dt.tz_convert('Asia/Kolkata')
                df_new.set_index('timestamp_ist', inplace=True, drop=False)
                df_new = df_new[['timestamp_ist', 'open', 'high', 'low', 'close', 'volume']]
            else:
                logging.error(f"[DATA ERROR] Tradejini {symbol_id} | Status: {response.status_code} | Response: {response.text}")
                return False, global_df
        except Exception as e:
            logging.error(f"[DATA EXCEPTION] Tradejini {symbol_id}: {e}")
            return False, global_df
        
    # Merge and update EMA
    last_global_ts = global_df['timestamp_ist'].iloc[-1]
    new_candles = df_new[df_new['timestamp_ist'] > last_global_ts]
    
    if not new_candles.empty:
        k = 2 / (5 + 1)
        for idx, row in new_candles.iterrows():
            last_ema = global_df['EMA5'].iloc[-1]
            new_ema  = (row['close'] * k) + (last_ema * (1 - k))
            row = row.copy()
            row['EMA5'] = new_ema
            # Use .loc[idx] to append/update while preserving the DatetimeIndex
            global_df.loc[idx] = row
        
        logging.info(f"Successfully updated EMA5 for {symboltoken}")
        return True, global_df
    
    return False, global_df


# ── Live LTP ───────────────────────────────────────────────────

def get_ltp(
    broker_ctx: dict,
    exchange: str,
    symbol: str,
    symboltoken: str,
) -> float | None:
    """
    Return the live last-traded price.
    Uses yfinance for indices, Tradejini v2 chart API for options.
    """
    now_ts = int(time.time())
    is_index = symboltoken in INDEX_YF_MAP
    
    if is_index:
        logging.info("[DATA] Using yfinance for index")
        ticker = INDEX_YF_MAP[symboltoken]
        
        cache_key = f"{ticker}_1m"
        cached_data = _yf_cache.get(cache_key)
        
        # Cache yfinance data for 5 seconds
        if cached_data and (now_ts - cached_data['ts']) < 5:
            return float(cached_data['ltp'])
            
        try:
            df = yf.download(ticker, interval="1m", period="1d", progress=False)
            if not df.empty:
                if isinstance(df.columns, pd.MultiIndex):
                    df.columns = df.columns.get_level_values(0)
                ltp = float(df['Close'].iloc[-1])
                _yf_cache[cache_key] = {'ts': now_ts, 'ltp': ltp}
                return ltp
            logging.error(f"[LTP] yfinance returned empty data for {ticker}")
        except Exception as e:
            logging.error(f"[LTP] yfinance fetch error: {e}")
        return None
        
    else:
        from_ts = now_ts - 600  # last 10 minutes
        symbol_id = symboltoken

        url = f"{BASE_URL}/api/mkt-data/chart/interval-data"
        params = {
            "id": symbol_id,
            "interval": "1",
            "from": from_ts,
            "to": now_ts,
        }

        for attempt in range(3):
            try:
                time.sleep(0.3)
                response = requests.get(
                    url, headers=_headers(broker_ctx), params=params, timeout=10
                )
                if response.status_code == 200:
                    res = response.json()
                    bars = res.get("d", {}).get("bars", [])
                    
                    if bars:
                        # Tradejini format: [time, open, high, low, close, volume, oi]
                        return float(bars[-1][4])
                    else:
                        logging.error(f"[LTP NFO] No bars in response for token={symbol_id} | raw={res}")
                else:
                    logging.error(f"[FETCH ERROR] Status: {response.status_code} | Token: {symbol_id} | Text: {response.text}")
                    
            except Exception as e:
                logging.error(f"[FETCH EXCEPTION] token={symbol_id} | {e}")
                if 'response' in locals():
                    logging.error(f"Raw Response: {response.text}")
                time.sleep(1)

        logging.error(f"[LTP NFO] All 3 attempts failed for token={symbol_id}")
        return None
