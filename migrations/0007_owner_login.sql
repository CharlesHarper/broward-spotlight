-- Owners sign in with a one-time link emailed to them; signing in starts a session kept in a cookie.
CREATE TABLE owner_logins (token TEXT PRIMARY KEY, email TEXT NOT NULL, expires_at TEXT NOT NULL, used_at TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE owner_sessions (id TEXT PRIMARY KEY, email TEXT NOT NULL, expires_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE INDEX idx_owner_logins_email ON owner_logins(email, created_at);
