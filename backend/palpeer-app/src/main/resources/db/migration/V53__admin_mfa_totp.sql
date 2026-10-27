-- Admin TOTP MFA (authenticator apps). One row per admin user_id.

CREATE TABLE admin_mfa_totp (
    id                  UUID            NOT NULL PRIMARY KEY,
    created_at          TIMESTAMPTZ     NOT NULL,
    updated_at          TIMESTAMPTZ     NOT NULL,
    created_by          VARCHAR(100),
    updated_by          VARCHAR(100),
    user_id             UUID            NOT NULL,
    secret_ciphertext   TEXT            NOT NULL,
    enabled             BOOLEAN         NOT NULL DEFAULT FALSE,
    enabled_at          TIMESTAMPTZ,
    CONSTRAINT uk_admin_mfa_totp_user UNIQUE (user_id),
    CONSTRAINT fk_admin_mfa_totp_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX idx_admin_mfa_totp_enabled ON admin_mfa_totp (enabled) WHERE enabled = TRUE;
