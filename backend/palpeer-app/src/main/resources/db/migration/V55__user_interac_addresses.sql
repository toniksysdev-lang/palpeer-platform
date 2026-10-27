-- Saved CAD Interac payer addresses (survive app reinstall).

CREATE TABLE user_interac_addresses (
    id              UUID            NOT NULL PRIMARY KEY,
    created_at      TIMESTAMPTZ     NOT NULL,
    updated_at      TIMESTAMPTZ     NOT NULL,
    created_by      VARCHAR(100),
    updated_by      VARCHAR(100),
    user_id         UUID            NOT NULL,
    email           VARCHAR(320)    NOT NULL,
    first_name      VARCHAR(80)     NOT NULL,
    last_name       VARCHAR(80)     NOT NULL,
    CONSTRAINT fk_user_interac_addresses_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT uk_user_interac_addresses_user_email UNIQUE (user_id, email)
);

CREATE INDEX idx_user_interac_addresses_user ON user_interac_addresses (user_id);
