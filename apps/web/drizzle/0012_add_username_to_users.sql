-- Add username column to users table and populate from email prefix
ALTER TABLE users ADD COLUMN username TEXT;
UPDATE users SET username = LOWER(CASE WHEN INSTR(email, '@') > 0 THEN SUBSTR(email, 1, INSTR(email, '@') - 1) ELSE email END) WHERE username IS NULL OR username = '';
UPDATE users SET username = 'admin' WHERE username = 'owner';
CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique ON users (username);
