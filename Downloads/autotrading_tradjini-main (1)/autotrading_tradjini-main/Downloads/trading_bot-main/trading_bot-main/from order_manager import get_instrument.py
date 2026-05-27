from order_manager import get_instrument_list, select_atm_option
from session_manager import get_user_session
import traceback
import inspect

USER_ID = "VITH973117"

try:
    print("\nFetching session...")

    broker_ctx = get_user_session(USER_ID)

    if not broker_ctx:
        print("❌ Session not found")
        exit()

    print("✅ Session loaded")

    print("\nLoading instruments...")

    df = get_instrument_list(USER_ID)

    if df is None:
        print("❌ Instrument list returned None")
        exit()

    if df.empty:
        print("❌ Instrument dataframe empty")
        exit()

    print(f"✅ Instruments loaded: {len(df)}")

    print("\nFirst 10 symbols:")
    print(df.head(10))

    # Show actual select_atm_option definition
    print("\nFunction Signature:")
    print(inspect.signature(select_atm_option))

    # Test LTP
    index_ltp = 23950.95

    print("\nSearching ATM option...")

    # Try using keyword arguments instead of positional
    result = select_atm_option(
        df_inst=df,
        index_name="NIFTY",
        index_ltp=index_ltp,
        user_id=USER_ID
    )

    print("\n========== RESULT ==========")

    if result is None:
        print("❌ No result returned")
    else:

        tok, sym, ltp = result

        print("TOKEN :", tok)
        print("SYMBOL:", sym)
        print("LTP    :", ltp)

except Exception:
    print("\nERROR:")
    print(traceback.format_exc())