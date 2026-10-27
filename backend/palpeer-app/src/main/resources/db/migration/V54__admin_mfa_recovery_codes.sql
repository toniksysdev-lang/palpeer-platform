-- Hashed one-time recovery codes for admin TOTP MFA (JSON array of SHA-256 hex digests).

ALTER TABLE admin_mfa_totp
    ADD COLUMN IF NOT EXISTS recovery_code_hashes TEXT;
