def check_strategy_signals(df):
    pass  # Deprecated by user request but kept for legacy imports.

def get_setup_levels(df):
    """
    Returns: (setup_valid, setup_low, setup_high, setup_ema, candle_timestamp)
    """
    if df is None or len(df) < 1:
        return False, None, None, None, None

    # The forming candle is safely removed inside data_fetcher.py. 
    # Therefore, [-1] is the most recently CLOSED candle. This should be our setup candle.
    setup_candle = df.iloc[-1]
    
    setup_high = float(setup_candle['high'])
    setup_low = float(setup_candle['low'])
    setup_ema = float(setup_candle['EMA5'])
    
    candle_time = setup_candle['timestamp_ist'] if 'timestamp_ist' in setup_candle else setup_candle.name
    
    print(f"EMA check -> Setup Candle Low: {setup_low}, Setup Candle EMA: {setup_ema}")

    # Strategy Condition: candle_low > EMA5
    setup_valid = setup_low > setup_ema

    if setup_valid:
        return True, setup_low, setup_high, setup_ema, candle_time

    return False, setup_low, setup_high, setup_ema, candle_time
