-- Phase 7: instant exchange quotes and transactions

CREATE TABLE exchange_quotes (
    id                     UUID            NOT NULL PRIMARY KEY,
    created_at             TIMESTAMPTZ     NOT NULL,
    updated_at             TIMESTAMPTZ     NOT NULL,
    created_by             VARCHAR(100),
    updated_by             VARCHAR(100),
    user_id                UUID            NOT NULL,
    source_wallet_id       UUID            NOT NULL,
    target_wallet_id       UUID            NOT NULL,
    source_currency_code   VARCHAR(10)     NOT NULL,
    target_currency_code   VARCHAR(10)     NOT NULL,
    source_amount          NUMERIC(28, 12) NOT NULL,
    target_amount          NUMERIC(28, 12) NOT NULL,
    applied_rate           NUMERIC(28, 12) NOT NULL,
    rate_side              VARCHAR(10)     NOT NULL,
    expires_at             TIMESTAMPTZ     NOT NULL,
    status                 VARCHAR(20)     NOT NULL,
    CONSTRAINT fk_exchange_quotes_user FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT fk_exchange_quotes_source_wallet FOREIGN KEY (source_wallet_id) REFERENCES wallets (id),
    CONSTRAINT fk_exchange_quotes_target_wallet FOREIGN KEY (target_wallet_id) REFERENCES wallets (id),
    CONSTRAINT chk_exchange_quotes_status CHECK (status IN ('OPEN', 'EXECUTED', 'EXPIRED', 'CANCELLED')),
    CONSTRAINT chk_exchange_quotes_amounts CHECK (source_amount > 0 AND target_amount > 0 AND applied_rate > 0)
);

CREATE INDEX idx_exchange_quotes_user_id ON exchange_quotes (user_id);
CREATE INDEX idx_exchange_quotes_status ON exchange_quotes (status);

CREATE TABLE exchange_transactions (
    id                      UUID            NOT NULL PRIMARY KEY,
    created_at              TIMESTAMPTZ     NOT NULL,
    updated_at              TIMESTAMPTZ     NOT NULL,
    created_by              VARCHAR(100),
    updated_by              VARCHAR(100),
    user_id                 UUID            NOT NULL,
    quote_id                UUID            NOT NULL,
    source_wallet_id        UUID            NOT NULL,
    target_wallet_id        UUID            NOT NULL,
    source_amount           NUMERIC(28, 12) NOT NULL,
    target_amount           NUMERIC(28, 12) NOT NULL,
    applied_rate            NUMERIC(28, 12) NOT NULL,
    status                  VARCHAR(20)     NOT NULL,
    idempotency_key         VARCHAR(100)    NOT NULL,
    debit_ledger_entry_id   UUID,
    credit_ledger_entry_id  UUID,
    failure_reason          VARCHAR(500),
    CONSTRAINT uk_exchange_transactions_idempotency UNIQUE (idempotency_key),
    CONSTRAINT fk_exchange_tx_user FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT fk_exchange_tx_quote FOREIGN KEY (quote_id) REFERENCES exchange_quotes (id),
    CONSTRAINT fk_exchange_tx_source_wallet FOREIGN KEY (source_wallet_id) REFERENCES wallets (id),
    CONSTRAINT fk_exchange_tx_target_wallet FOREIGN KEY (target_wallet_id) REFERENCES wallets (id),
    CONSTRAINT chk_exchange_tx_status CHECK (status IN ('INITIATED', 'SUCCESS', 'FAILED')),
    CONSTRAINT chk_exchange_tx_amounts CHECK (source_amount > 0 AND target_amount > 0 AND applied_rate > 0)
);

CREATE INDEX idx_exchange_tx_user_id ON exchange_transactions (user_id);
CREATE INDEX idx_exchange_tx_quote_id ON exchange_transactions (quote_id);
