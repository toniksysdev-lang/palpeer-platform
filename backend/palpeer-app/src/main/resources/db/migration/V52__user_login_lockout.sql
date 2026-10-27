-- Password-login brute-force lockout (mirrors PIN attempt lockout semantics).

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS failed_login_attempts INT NOT NULL DEFAULT 0;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS login_locked_until TIMESTAMPTZ;
