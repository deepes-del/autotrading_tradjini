"""
strategy_three.py — Independent strategy module for Strategy Three (EMA21 rejection/recovery).
"""
import pandas as pd

def check_setup_ce(setup_low: float, setup_close: float, setup_ema: float) -> bool:
    """
    CE Setup Candle: low < EMA21 AND close > EMA21
    """
    return setup_low < setup_ema and setup_close > setup_ema

def check_setup_pe(setup_high: float, setup_close: float, setup_ema: float) -> bool:
    """
    PE Setup Candle: high > EMA21 AND close < EMA21
    """
    return setup_high > setup_ema and setup_close < setup_ema

def calculate_ema21(df: pd.DataFrame) -> pd.Series:
    """
    Calculate EMA21 on close prices.
    """
    return df['close'].ewm(span=51, adjust=False).mean()

def check_confirmation_ce(open_price: float, low_price: float, ema: float) -> bool:
    """
    CE Confirmation Candle: open > EMA21 AND low > EMA21
    """
    return open_price > ema and low_price > ema

def check_confirmation_pe(open_price: float, high_price: float, ema: float) -> bool:
    """
    PE Confirmation Candle: open < EMA21 AND high < EMA21
    """
    return open_price < ema and high_price < ema

