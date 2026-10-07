-- Phase 5: wallets and ledger (balances are ledger-driven projections)

CREATE TABLE wallets (
    id                  UUID            NOT NULL PRIMARY KEY,
    created_at          TIMESTAMPTZ     NOT NULL,
    updated_at          TIMESTAMPTZ     NOT NULL,
    created_by          VARCHAR(100),
    updated_by          VARCHAR(100),
    user_id             UUID            NOT NULL,
    currency_code       VARCHAR(10)     NOT NULL,
    available_balance   NUMERIC(28, 12) NOT NULL DEFAULT 0,
    pending_balance     NUMERIC(28, 12) NOT NULL DEFAULT 0,
    version             BIGINT          NOT NULL DEFAULT 0,
    CONSTRAINT uk_wallets_user_currency UNIQUE (user_id, currency_code),
    CONSTRAINT fk_wallets_user FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT fk_wallets_currency FOREIGN KEY (currency_code) REFERENCES currencies (code),
    CONSTRAINT chk_wallets_available_nonneg CHECK (available_balance >= 0),
    CONSTRAINT chk_wallets_pending_nonneg CHECK (pending_balance >= 0)
);

CREATE INDEX idx_wallets_user_id ON wallets (user_id);

CREATE TABLE ledger_entries (
    id                        UUID            NOT NULL PRIMARY KEY,
    created_at                TIMESTAMPTZ     NOT NULL,
    updated_at                TIMESTAMPTZ     NOT NULL,
    created_by                VARCHAR(100),
    updated_by                VARCHAR(100),
    wallet_id                 UUID            NOT NULL,
    entry_type                VARCHAR(20)     NOT NULL,
    amount                    NUMERIC(28, 12) NOT NULL,
    currency_code             VARCHAR(10)     NOT NULL,
    available_balance_after   NUMERIC(28, 12) NOT NULL,
    pending_balance_after     NUMERIC(28, 12) NOT NULL,
    idempotency_key           VARCHAR(100)    NOT NULL,
    reference_type            VARCHAR(60),
    reference_id              VARCHAR(100),
    description               VARCHAR(500),
    CONSTRAINT uk_ledger_entries_idempotency UNIQUE (idempotency_key),
    CONSTRAINT fk_ledger_entries_wallet FOREIGN KEY (wallet_id) REFERENCES wallets (id),
    CONSTRAINT chk_ledger_entries_amount_positive CHECK (amount > 0),
    CONSTRAINT chk_ledger_entries_type
        CHECK (entry_type IN ('CREDIT', 'DEBIT', 'HOLD', 'RELEASE'))
);

CREATE INDEX idx_ledger_entries_wallet_created
    ON ledger_entries (wallet_id, created_at DESC);
CREATE INDEX idx_ledger_entries_reference
    ON ledger_entries (reference_type, reference_id);
