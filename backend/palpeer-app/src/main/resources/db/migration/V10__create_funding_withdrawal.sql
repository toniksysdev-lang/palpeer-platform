-- Phase 6: funding and withdrawal transactions (idempotent, ledger-linked)

CREATE TABLE funding_transactions (
    id                        UUID            NOT NULL PRIMARY KEY,
    created_at                TIMESTAMPTZ     NOT NULL,
    updated_at                TIMESTAMPTZ     NOT NULL,
    created_by                VARCHAR(100),
    updated_by                VARCHAR(100),
    user_id                   UUID            NOT NULL,
    wallet_id                 UUID            NOT NULL,
    amount                    NUMERIC(28, 12) NOT NULL,
    currency_code             VARCHAR(10)     NOT NULL,
    status                    VARCHAR(20)     NOT NULL,
    idempotency_key           VARCHAR(100)    NOT NULL,
    ledger_entry_id           UUID,
    reversal_ledger_entry_id  UUID,
    failure_reason            VARCHAR(500),
    provider_reference        VARCHAR(120),
    CONSTRAINT uk_funding_transactions_idempotency UNIQUE (idempotency_key),
    CONSTRAINT fk_funding_user FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT fk_funding_wallet FOREIGN KEY (wallet_id) REFERENCES wallets (id),
    CONSTRAINT chk_funding_amount_positive CHECK (amount > 0),
    CONSTRAINT chk_funding_status CHECK (status IN (
        'INITIATED', 'PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'REVERSED'
    ))
);

CREATE INDEX idx_funding_user_id ON funding_transactions (user_id);
CREATE INDEX idx_funding_wallet_id ON funding_transactions (wallet_id);
CREATE INDEX idx_funding_status ON funding_transactions (status);

CREATE TABLE withdrawal_transactions (
    id                        UUID            NOT NULL PRIMARY KEY,
    created_at                TIMESTAMPTZ     NOT NULL,
    updated_at                TIMESTAMPTZ     NOT NULL,
    created_by                VARCHAR(100),
    updated_by                VARCHAR(100),
    user_id                   UUID            NOT NULL,
    wallet_id                 UUID            NOT NULL,
    amount                    NUMERIC(28, 12) NOT NULL,
    currency_code             VARCHAR(10)     NOT NULL,
    status                    VARCHAR(20)     NOT NULL,
    idempotency_key           VARCHAR(100)    NOT NULL,
    hold_ledger_entry_id      UUID,
    debit_ledger_entry_id     UUID,
    release_ledger_entry_id   UUID,
    reversal_ledger_entry_id  UUID,
    failure_reason            VARCHAR(500),
    destination_reference     VARCHAR(120),
    CONSTRAINT uk_withdrawal_transactions_idempotency UNIQUE (idempotency_key),
    CONSTRAINT fk_withdrawal_user FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT fk_withdrawal_wallet FOREIGN KEY (wallet_id) REFERENCES wallets (id),
    CONSTRAINT chk_withdrawal_amount_positive CHECK (amount > 0),
    CONSTRAINT chk_withdrawal_status CHECK (status IN (
        'INITIATED', 'PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'REVERSED'
    ))
);

CREATE INDEX idx_withdrawal_user_id ON withdrawal_transactions (user_id);
CREATE INDEX idx_withdrawal_wallet_id ON withdrawal_transactions (wallet_id);
CREATE INDEX idx_withdrawal_status ON withdrawal_transactions (status);
