def get_setup_levels(df):
    """
    Returns: (setup_valid, setup_low, setup_high, setup_ema, candle_timestamp, candle_size)
    """
    if df is None or len(df) < 1:
        return False, None, None, None, None, None

    # The forming candle is safely removed inside data_fetcher.py. 
    # Therefore, [-1] is the most recently CLOSED candle.
    setup_candle = df.iloc[-1]
    
    setup_high = float(setup_candle['high'])
    setup_low = float(setup_candle['low'])
    setup_ema = float(setup_candle['EMA5'])
    
    candle_time = setup_candle['timestamp_ist'] if 'timestamp_ist' in setup_candle else setup_candle.name
    
    candle_size = setup_high - setup_low

    print(f"[STRATEGY TWO] EMA check -> Low: {setup_low}, EMA: {setup_ema}, Size: {candle_size}")

    # Strategy Two Conditions: 
    # 1. candle_low > EMA5
    # 2. candle_size <= 25 points
    
    ema_valid = setup_low > setup_ema
    size_valid = candle_size <= 25

    setup_valid = ema_valid and size_valid

    return setup_valid, setup_low, setup_high, setup_ema, candle_time, candle_size
