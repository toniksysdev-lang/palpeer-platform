-- Phase 1: users (verified fields only)

CREATE TABLE users (
    id               UUID            NOT NULL PRIMARY KEY,
    created_at       TIMESTAMPTZ     NOT NULL,
    updated_at       TIMESTAMPTZ     NOT NULL,
    created_by       VARCHAR(100),
    updated_by       VARCHAR(100),
    email            VARCHAR(320)    NOT NULL,
    phone            VARCHAR(32)     NOT NULL,
    password_hash    VARCHAR(255)    NOT NULL,
    status           VARCHAR(40)     NOT NULL,
    enabled          BOOLEAN         NOT NULL,
    email_verified   BOOLEAN         NOT NULL,
    phone_verified   BOOLEAN         NOT NULL,
    CONSTRAINT uk_users_email UNIQUE (email),
    CONSTRAINT uk_users_phone UNIQUE (phone)
);

CREATE INDEX idx_users_status ON users (status);
CREATE INDEX idx_users_enabled ON users (enabled);
