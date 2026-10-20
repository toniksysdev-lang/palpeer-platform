-- Separate lockout counters so wrong security answers do not burn PIN attempts (and vice versa).
-- Both still use admin Settings → PIN lockout (max attempts + hours).

ALTER TABLE pin_credentials
    ADD COLUMN IF NOT EXISTS security_answer_failed_attempts INTEGER NOT NULL DEFAULT 0;

ALTER TABLE pin_credentials
    ADD COLUMN IF NOT EXISTS security_answer_locked_until TIMESTAMPTZ;

-- Clear any active PIN lock left from shared-counter attempts so operators can continue.
UPDATE pin_credentials
SET failed_attempts = 0,
    locked_until = NULL
WHERE locked_until IS NOT NULL;
