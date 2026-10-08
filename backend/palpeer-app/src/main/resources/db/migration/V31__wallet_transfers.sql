-- Peer wallet-to-wallet transfers (same currency)

CREATE TABLE wallet_transfers (
    id                      UUID            NOT NULL PRIMARY KEY,
    created_at              TIMESTAMPTZ     NOT NULL,
    updated_at              TIMESTAMPTZ     NOT NULL,
    created_by              VARCHAR(100),
    updated_by              VARCHAR(100),
    sender_user_id          UUID            NOT NULL,
    recipient_user_id       UUID            NOT NULL,
    source_wallet_id        UUID            NOT NULL,
    destination_wallet_id   UUID            NOT NULL,
    currency_code           VARCHAR(10)     NOT NULL,
    amount                  NUMERIC(28, 12) NOT NULL,
    idempotency_key         VARCHAR(100)    NOT NULL,
    note                    VARCHAR(500),
    CONSTRAINT uk_wallet_transfers_idempotency UNIQUE (idempotency_key),
    CONSTRAINT fk_wallet_transfers_sender FOREIGN KEY (sender_user_id) REFERENCES users (id),
    CONSTRAINT fk_wallet_transfers_recipient FOREIGN KEY (recipient_user_id) REFERENCES users (id),
    CONSTRAINT fk_wallet_transfers_source FOREIGN KEY (source_wallet_id) REFERENCES wallets (id),
    CONSTRAINT fk_wallet_transfers_dest FOREIGN KEY (destination_wallet_id) REFERENCES wallets (id),
    CONSTRAINT fk_wallet_transfers_currency FOREIGN KEY (currency_code) REFERENCES currencies (code),
    CONSTRAINT chk_wallet_transfers_amount_positive CHECK (amount > 0),
    CONSTRAINT chk_wallet_transfers_parties CHECK (sender_user_id <> recipient_user_id)
);

CREATE INDEX idx_wallet_transfers_sender_created
    ON wallet_transfers (sender_user_id, created_at DESC);
CREATE INDEX idx_wallet_transfers_recipient_created
    ON wallet_transfers (recipient_user_id, created_at DESC);
