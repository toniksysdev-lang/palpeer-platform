-- Saved NGN withdrawal bank accounts (survive app reinstall).

CREATE TABLE user_ngn_bank_accounts (
    id              UUID            NOT NULL PRIMARY KEY,
    created_at      TIMESTAMPTZ     NOT NULL,
    updated_at      TIMESTAMPTZ     NOT NULL,
    created_by      VARCHAR(100),
    updated_by      VARCHAR(100),
    user_id         UUID            NOT NULL,
    bank_code       VARCHAR(20)     NOT NULL,
    bank_name       VARCHAR(120)    NOT NULL,
    account_number  VARCHAR(20)     NOT NULL,
    account_name    VARCHAR(160)    NOT NULL,
    CONSTRAINT fk_user_ngn_bank_accounts_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT uk_user_ngn_bank_accounts_user_bank_acct UNIQUE (user_id, bank_code, account_number)
);

CREATE INDEX idx_user_ngn_bank_accounts_user ON user_ngn_bank_accounts (user_id);
