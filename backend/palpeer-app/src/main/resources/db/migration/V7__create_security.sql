-- Phase 3: transaction PIN, security questions, biometric devices

CREATE TABLE pin_credentials (
    id               UUID            NOT NULL PRIMARY KEY,
    created_at       TIMESTAMPTZ     NOT NULL,
    updated_at       TIMESTAMPTZ     NOT NULL,
    created_by       VARCHAR(100),
    updated_by       VARCHAR(100),
    user_id          UUID            NOT NULL,
    pin_hash         VARCHAR(255)    NOT NULL,
    CONSTRAINT uk_pin_credentials_user_id UNIQUE (user_id),
    CONSTRAINT fk_pin_credentials_user FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE TABLE security_questions (
    id               UUID            NOT NULL PRIMARY KEY,
    created_at       TIMESTAMPTZ     NOT NULL,
    updated_at       TIMESTAMPTZ     NOT NULL,
    created_by       VARCHAR(100),
    updated_by       VARCHAR(100),
    user_id          UUID            NOT NULL,
    question_key     VARCHAR(120)    NOT NULL,
    question_text    VARCHAR(500)    NOT NULL,
    answer_hash      VARCHAR(255)    NOT NULL,
    CONSTRAINT uk_security_questions_user_question UNIQUE (user_id, question_key),
    CONSTRAINT fk_security_questions_user FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE INDEX idx_security_questions_user_id ON security_questions (user_id);

CREATE TABLE devices (
    id                    UUID            NOT NULL PRIMARY KEY,
    created_at            TIMESTAMPTZ     NOT NULL,
    updated_at            TIMESTAMPTZ     NOT NULL,
    created_by            VARCHAR(100),
    updated_by            VARCHAR(100),
    user_id               UUID            NOT NULL,
    device_identifier     VARCHAR(255)    NOT NULL,
    platform              VARCHAR(40),
    device_name           VARCHAR(120),
    biometric_credential  VARCHAR(2000)   NOT NULL,
    enabled               BOOLEAN         NOT NULL,
    last_used_at          TIMESTAMPTZ,
    CONSTRAINT uk_devices_user_device UNIQUE (user_id, device_identifier),
    CONSTRAINT fk_devices_user FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE INDEX idx_devices_user_id ON devices (user_id);
CREATE INDEX idx_devices_enabled ON devices (enabled);
