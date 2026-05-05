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

-- Index for fast per-user lookups
CREATE INDEX IF NOT EXISTS idx_user_errors_user_id
    ON user_errors (user_id, created_at DESC);

-- ── 2. TRADES TABLE ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS trades (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         text        NOT NULL,
    symbol          text        NOT NULL,
    side            text        NOT NULL DEFAULT 'BUY',  -- BUY / SELL
    qty             integer     NOT NULL,
    entry_price     numeric(12, 2) NOT NULL,
    exit_price      numeric(12, 2),                      -- nullable until closed
    sl              numeric(12, 2) NOT NULL,
    target          numeric(12, 2) NOT NULL,
    status          text        NOT NULL DEFAULT 'OPEN', -- OPEN / CLOSED
    created_at      timestamptz NOT NULL DEFAULT now(),
    closed_at       timestamptz                          -- nullable until closed
);

-- Index for fast per-user trade history
CREATE INDEX IF NOT EXISTS idx_trades_user_id
    ON trades (user_id, created_at DESC);

-- ── 3. ROW-LEVEL SECURITY (recommended for production) ──────
-- Enable RLS and only expose rows to service-role key (backend).
-- Your anon key used in the backend bypasses RLS if the table
-- policy allows service_role access. For now, leave open and
-- lock down once you move to a dedicated service-role key.

-- ALTER TABLE user_errors ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE trades      ENABLE ROW LEVEL SECURITY;
