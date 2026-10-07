-- Phase 12: device push tokens and notifications

CREATE TABLE device_tokens (
    id                  UUID          NOT NULL PRIMARY KEY,
    created_at          TIMESTAMPTZ   NOT NULL,
    updated_at          TIMESTAMPTZ   NOT NULL,
    created_by          VARCHAR(100),
    updated_by          VARCHAR(100),
    user_id             UUID          NOT NULL,
    token               VARCHAR(512)  NOT NULL,
    platform            VARCHAR(40)   NOT NULL,
    device_identifier   VARCHAR(255),
    enabled             BOOLEAN       NOT NULL,
    last_seen_at        TIMESTAMPTZ,
    CONSTRAINT uk_device_tokens_token UNIQUE (token),
    CONSTRAINT fk_device_tokens_user FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE INDEX idx_device_tokens_user_id ON device_tokens (user_id);
CREATE INDEX idx_device_tokens_user_enabled ON device_tokens (user_id, enabled);

CREATE TABLE notifications (
    id                  UUID          NOT NULL PRIMARY KEY,
    created_at          TIMESTAMPTZ   NOT NULL,
    updated_at          TIMESTAMPTZ   NOT NULL,
    created_by          VARCHAR(100),
    updated_by          VARCHAR(100),
    user_id             UUID          NOT NULL,
    title               VARCHAR(200)  NOT NULL,
    body                VARCHAR(2000) NOT NULL,
    category            VARCHAR(80),
    channel             VARCHAR(20)   NOT NULL,
    status              VARCHAR(20)   NOT NULL,
    reference_type      VARCHAR(80),
    reference_id        UUID,
    read_at             TIMESTAMPTZ,
    sent_at             TIMESTAMPTZ,
    failure_reason      VARCHAR(500),
    CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE INDEX idx_notifications_user_created ON notifications (user_id, created_at DESC);
CREATE INDEX idx_notifications_user_status ON notifications (user_id, status);
