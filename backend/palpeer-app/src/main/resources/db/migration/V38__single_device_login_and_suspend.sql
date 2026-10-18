-- Single-device sessions: bind refresh tokens to an install, and one-time suspend tokens
-- for new-device login alerts (token is emailed — never password/PIN).

ALTER TABLE refresh_tokens
    ADD COLUMN device_identifier VARCHAR(128),
    ADD COLUMN device_name VARCHAR(120),
    ADD COLUMN platform VARCHAR(40);

CREATE INDEX idx_refresh_tokens_user_device
    ON refresh_tokens (user_id, device_identifier);

CREATE TABLE account_suspend_tokens (
    id                 UUID            NOT NULL PRIMARY KEY,
    created_at         TIMESTAMPTZ     NOT NULL,
    updated_at         TIMESTAMPTZ     NOT NULL,
    created_by         VARCHAR(100),
    updated_by         VARCHAR(100),
    user_id            UUID            NOT NULL,
    token_hash         VARCHAR(128)    NOT NULL,
    device_identifier  VARCHAR(128),
    device_name        VARCHAR(120),
    platform           VARCHAR(40),
    expires_at         TIMESTAMPTZ     NOT NULL,
    consumed           BOOLEAN         NOT NULL DEFAULT FALSE,
    consumed_at        TIMESTAMPTZ,
    CONSTRAINT uk_account_suspend_tokens_hash UNIQUE (token_hash),
    CONSTRAINT fk_account_suspend_tokens_user FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE INDEX idx_account_suspend_tokens_user ON account_suspend_tokens (user_id);
CREATE INDEX idx_account_suspend_tokens_expires ON account_suspend_tokens (expires_at);
