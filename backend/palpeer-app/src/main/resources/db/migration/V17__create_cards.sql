-- Phase 13: cards and card transactions (provider-backed; ledger settlement deferred)

CREATE TABLE cards (
    id                  UUID          NOT NULL PRIMARY KEY,
    created_at          TIMESTAMPTZ   NOT NULL,
    updated_at          TIMESTAMPTZ   NOT NULL,
    created_by          VARCHAR(100),
    updated_by          VARCHAR(100),
    user_id             UUID          NOT NULL,
    wallet_id           UUID,
    provider_name       VARCHAR(80)   NOT NULL,
    provider_card_id    VARCHAR(120)  NOT NULL,
    last_four           VARCHAR(4)    NOT NULL,
    brand               VARCHAR(40),
    currency_code       VARCHAR(10)   NOT NULL,
    status              VARCHAR(20)   NOT NULL,
    expiry_month        SMALLINT,
    expiry_year         SMALLINT,
    cardholder_name     VARCHAR(120),
    CONSTRAINT uk_cards_provider_card UNIQUE (provider_name, provider_card_id),
    CONSTRAINT fk_cards_user FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT fk_cards_wallet FOREIGN KEY (wallet_id) REFERENCES wallets (id),
    CONSTRAINT fk_cards_currency FOREIGN KEY (currency_code) REFERENCES currencies (code)
);

CREATE INDEX idx_cards_user_id ON cards (user_id);
CREATE INDEX idx_cards_user_status ON cards (user_id, status);

CREATE TABLE card_transactions (
    id                        UUID           NOT NULL PRIMARY KEY,
    created_at                TIMESTAMPTZ    NOT NULL,
    updated_at                TIMESTAMPTZ    NOT NULL,
    created_by                VARCHAR(100),
    updated_by                VARCHAR(100),
    card_id                   UUID           NOT NULL,
    user_id                   UUID           NOT NULL,
    provider_transaction_id   VARCHAR(120)   NOT NULL,
    entry_type                VARCHAR(20)    NOT NULL,
    status                    VARCHAR(20)    NOT NULL,
    amount                    NUMERIC(28,12) NOT NULL,
    currency_code             VARCHAR(10)    NOT NULL,
    merchant_name             VARCHAR(200),
    occurred_at               TIMESTAMPTZ    NOT NULL,
    ledger_entry_id           UUID,
    failure_reason            VARCHAR(500),
    CONSTRAINT uk_card_tx_provider UNIQUE (card_id, provider_transaction_id),
    CONSTRAINT fk_card_tx_card FOREIGN KEY (card_id) REFERENCES cards (id),
    CONSTRAINT fk_card_tx_user FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT fk_card_tx_currency FOREIGN KEY (currency_code) REFERENCES currencies (code),
    CONSTRAINT chk_card_tx_amount_positive CHECK (amount > 0)
);

CREATE INDEX idx_card_tx_user_occurred ON card_transactions (user_id, occurred_at DESC);
CREATE INDEX idx_card_tx_card_occurred ON card_transactions (card_id, occurred_at DESC);
