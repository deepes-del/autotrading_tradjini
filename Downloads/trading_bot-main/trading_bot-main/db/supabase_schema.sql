-- ============================================================
-- CubePlus Trading SaaS — COMPLETE Supabase Schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS users (
    user_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    age INT,
    occupation TEXT,
    phone TEXT UNIQUE,
    password TEXT NOT NULL,
    status TEXT DEFAULT 'pending',  -- pending / approved / blocked
    bot_running BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. ADMIN TABLE
CREATE TABLE IF NOT EXISTS admin (
    username TEXT PRIMARY KEY,
    password TEXT NOT NULL
);

-- 3. APP SESSIONS TABLE (Persistent Auth)
CREATE TABLE IF NOT EXISTS app_sessions (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_token    text        NOT NULL UNIQUE,
    user_id          text        NOT NULL,
    created_at       timestamptz NOT NULL DEFAULT now(),
    expires_at       timestamptz,
    is_active        boolean     NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_app_sessions_user_id ON app_sessions (user_id);

-- 4. BROKER SESSIONS TABLE (BYOK Storage)
CREATE TABLE IF NOT EXISTS broker_sessions (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          text        NOT NULL,
    broker_name      text        NOT NULL DEFAULT 'tradejini',
    api_key          text        NOT NULL DEFAULT '',   -- BYOK: user's own Tradejini API key
    client_id        text        NOT NULL,
    access_token     text        NOT NULL,
    token_created_at timestamptz NOT NULL DEFAULT now(),
    is_active        boolean     NOT NULL DEFAULT true,
    UNIQUE(user_id, broker_name)
);

-- 5. USER ERRORS TABLE
CREATE TABLE IF NOT EXISTS user_errors (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      text        NOT NULL,
    error_type   text        NOT NULL,
    error_message text       NOT NULL,
    severity     text        NOT NULL DEFAULT 'ERROR',
    raw_response jsonb,
    created_at   timestamptz NOT NULL DEFAULT now()
);

-- 6. STRATEGY TRADES (Signals)
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

-- 7. BROKER TRADES (Actual Executions)
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

-- 8. BROKER CONFIGS TABLE (Persistent BYOK Settings)
CREATE TABLE IF NOT EXISTS broker_configs (
    user_id          text        PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    broker_name      text        NOT NULL DEFAULT 'tradejini',
    api_key          text        NOT NULL,
    client_id        text        NOT NULL,
    totp_secret      text        NOT NULL,
    updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_broker_configs_user_id ON broker_configs (user_id);

-- Default Admin
INSERT INTO admin (username, password) VALUES ('admin', 'admin123') ON CONFLICT DO NOTHING;
