-- Phase 1: refresh tokens (JWT refresh revocation / rotation support)

CREATE TABLE refresh_tokens (
    id               UUID            NOT NULL PRIMARY KEY,
    created_at       TIMESTAMPTZ     NOT NULL,
    updated_at       TIMESTAMPTZ     NOT NULL,
    created_by       VARCHAR(100),
    updated_by       VARCHAR(100),
    user_id          UUID            NOT NULL,
    token_hash       VARCHAR(128)    NOT NULL,
    expires_at       TIMESTAMPTZ     NOT NULL,
    revoked          BOOLEAN         NOT NULL DEFAULT FALSE,
    revoked_at       TIMESTAMPTZ,
    replaced_by_hash VARCHAR(128),
    CONSTRAINT uk_refresh_tokens_token_hash UNIQUE (token_hash),
    CONSTRAINT fk_refresh_tokens_user FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens (user_id);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens (expires_at);
