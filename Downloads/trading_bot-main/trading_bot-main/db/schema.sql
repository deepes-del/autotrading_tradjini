-- ============================================================
-- CubePlus Trading SaaS — Supabase Schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- ── 1. USER ERRORS TABLE ────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_errors (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      text        NOT NULL,
    error_type   text        NOT NULL,            -- e.g. ORDER_FAILED, LOGIN_FAILED
    error_message text       NOT NULL,
    severity     text        NOT NULL DEFAULT 'ERROR', -- INFO / WARNING / ERROR / CRITICAL
    raw_response jsonb,
    created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_errors_user_id
    ON user_errors (user_id, created_at DESC);

-- ── 2. STRATEGY TRADES (Signals) ───────────────────────────

CREATE TABLE IF NOT EXISTS strategy_trades (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         text        NOT NULL,
    symbol          text        NOT NULL,
    side            text        NOT NULL DEFAULT 'BUY',
    qty             integer     NOT NULL,
    entry_price     numeric(12, 2) NOT NULL,
    sl              numeric(12, 2) NOT NULL,
    target          numeric(12, 2) NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_strategy_trades_user_id
    ON strategy_trades (user_id, created_at DESC);


-- ── 3. BROKER TRADES (Actual Executions) ───────────────────

CREATE TABLE IF NOT EXISTS broker_trades (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         text        NOT NULL,
    strategy_trade_id uuid      REFERENCES strategy_trades(id),
    symbol          text        NOT NULL,
    side            text        NOT NULL DEFAULT 'BUY',
    qty             integer     NOT NULL,
    executed_price  numeric(12, 2) NOT NULL,
    exit_price      numeric(12, 2),
    sl              numeric(12, 2) NOT NULL,
    target          numeric(12, 2) NOT NULL,
    status          text        NOT NULL DEFAULT 'OPEN', -- OPEN / CLOSED
    broker_order_id text        NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    closed_at       timestamptz
);

CREATE INDEX IF NOT EXISTS idx_broker_trades_user_id
    ON broker_trades (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_broker_trades_broker_order_id
    ON broker_trades (broker_order_id);

-- Optional: Drop old trades table if it exists
-- DROP TABLE IF EXISTS trades;
