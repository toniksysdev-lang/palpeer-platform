-- Phase 1: OTP challenges (verify / password-reset flows)
-- CONTRACT_PENDING: purpose catalog, TTL, length, channel rules

CREATE TABLE otp_challenges (
    id               UUID            NOT NULL PRIMARY KEY,
    created_at       TIMESTAMPTZ     NOT NULL,
    updated_at       TIMESTAMPTZ     NOT NULL,
    created_by       VARCHAR(100),
    updated_by       VARCHAR(100),
    user_id          UUID            NOT NULL,
    purpose          VARCHAR(40)     NOT NULL,
    channel          VARCHAR(20)     NOT NULL,
    destination      VARCHAR(320)    NOT NULL,
    code_hash        VARCHAR(128)    NOT NULL,
    expires_at       TIMESTAMPTZ     NOT NULL,
    consumed         BOOLEAN         NOT NULL DEFAULT FALSE,
    consumed_at      TIMESTAMPTZ,
    attempt_count    INTEGER         NOT NULL DEFAULT 0,
    CONSTRAINT fk_otp_challenges_user FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE INDEX idx_otp_challenges_user_purpose ON otp_challenges (user_id, purpose);
CREATE INDEX idx_otp_challenges_expires_at ON otp_challenges (expires_at);
