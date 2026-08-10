CREATE TABLE IF NOT EXISTS telegram_login_codes (
  code TEXT PRIMARY KEY,
  session_token TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
