-- 1. USERS TABLE
CREATE TABLE users (
    user_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    age INT,
    occupation TEXT,
    phone TEXT UNIQUE,
    password TEXT NOT NULL,
    status TEXT DEFAULT 'pending',  -- pending / approved
    bot_running BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. ADMIN TABLE
CREATE TABLE admin (
    username TEXT PRIMARY KEY,
    password TEXT NOT NULL
);

-- Optional Future: User Sessions
CREATE TABLE user_sessions (
    user_id TEXT,
    access_token TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert a default admin for testing
INSERT INTO admin (username, password) VALUES ('admin', 'admin123') ON CONFLICT DO NOTHING;
