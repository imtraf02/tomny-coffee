PRAGMA foreign_keys = OFF;

CREATE TABLE users_new (
  id TEXT PRIMARY KEY NOT NULL,
  username TEXT NOT NULL UNIQUE,
  email TEXT,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

INSERT INTO users_new (id, username, email, display_name, password_hash, active, created_at, updated_at)
SELECT id, COALESCE(username, CASE WHEN INSTR(email, '@') > 0 THEN SUBSTR(email, 1, INSTR(email, '@') - 1) ELSE email END, 'user'), email, display_name, password_hash, active, created_at, updated_at
FROM users;

DROP TABLE users;

ALTER TABLE users_new RENAME TO users;

CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique ON users (username);

PRAGMA foreign_keys = ON;
