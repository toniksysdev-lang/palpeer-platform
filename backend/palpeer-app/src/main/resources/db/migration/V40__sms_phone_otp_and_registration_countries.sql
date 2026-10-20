-- Pre-registration phone OTP (nullable user_id) + verified-phone window + registration country flags

ALTER TABLE otp_challenges
    ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE otp_challenges
    DROP CONSTRAINT IF EXISTS fk_otp_challenges_user;

ALTER TABLE otp_challenges
    ADD CONSTRAINT fk_otp_challenges_user
        FOREIGN KEY (user_id) REFERENCES users (id);

CREATE INDEX IF NOT EXISTS idx_otp_challenges_destination_purpose
    ON otp_challenges (destination, purpose, consumed);

CREATE TABLE phone_pre_verifications (
    id           UUID         NOT NULL PRIMARY KEY,
    created_at   TIMESTAMPTZ  NOT NULL,
    updated_at   TIMESTAMPTZ  NOT NULL,
    created_by   VARCHAR(100),
    updated_by   VARCHAR(100),
    phone        VARCHAR(32)  NOT NULL,
    verified_at  TIMESTAMPTZ  NOT NULL,
    expires_at   TIMESTAMPTZ  NOT NULL,
    CONSTRAINT uk_phone_pre_verifications_phone UNIQUE (phone)
);

CREATE INDEX idx_phone_pre_verifications_expires ON phone_pre_verifications (expires_at);

CREATE TABLE platform_settings (
    id           UUID          NOT NULL PRIMARY KEY,
    created_at   TIMESTAMPTZ   NOT NULL,
    updated_at   TIMESTAMPTZ   NOT NULL,
    created_by   VARCHAR(100),
    updated_by   VARCHAR(100),
    setting_key  VARCHAR(100)  NOT NULL,
    setting_value TEXT         NOT NULL,
    CONSTRAINT uk_platform_settings_key UNIQUE (setting_key)
);

-- Default: all corridor countries enabled for mobile registration
INSERT INTO platform_settings (id, created_at, updated_at, created_by, updated_by, setting_key, setting_value)
VALUES (
    'a40e0000-0000-4000-8000-000000000040',
    NOW(),
    NOW(),
    'migration',
    'migration',
    'registration.allowed_countries',
    '["CA","US","GB","NG","GH","KE"]'
);
