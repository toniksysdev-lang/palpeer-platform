-- Platform fee revenue ledger (P2P + InstantEX) and InstantEX fee tiers.

CREATE TABLE IF NOT EXISTS platform_fee_revenues (
    id                   UUID            NOT NULL PRIMARY KEY,
    created_at           TIMESTAMPTZ     NOT NULL,
    updated_at           TIMESTAMPTZ     NOT NULL,
    created_by           VARCHAR(100),
    updated_by           VARCHAR(100),
    source_type          VARCHAR(32)     NOT NULL,
    reference_type       VARCHAR(64)     NOT NULL,
    reference_id         UUID            NOT NULL,
    user_id              UUID            NOT NULL,
    currency_code        VARCHAR(10)     NOT NULL,
    amount               NUMERIC(28, 12) NOT NULL,
    description          VARCHAR(500),
    CONSTRAINT chk_platform_fee_revenues_source CHECK (source_type IN ('P2P', 'INSTANT_EX')),
    CONSTRAINT chk_platform_fee_revenues_amount CHECK (amount > 0),
    CONSTRAINT fk_platform_fee_revenues_currency
        FOREIGN KEY (currency_code) REFERENCES currencies (code),
    CONSTRAINT fk_platform_fee_revenues_user
        FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_platform_fee_revenues_reference
    ON platform_fee_revenues (source_type, reference_type, reference_id);

CREATE INDEX IF NOT EXISTS idx_platform_fee_revenues_created
    ON platform_fee_revenues (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_platform_fee_revenues_source_currency_created
    ON platform_fee_revenues (source_type, currency_code, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_platform_fee_revenues_user_created
    ON platform_fee_revenues (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS instantex_fee_tiers (
    id                   UUID            NOT NULL PRIMARY KEY,
    created_at           TIMESTAMPTZ     NOT NULL,
    updated_at           TIMESTAMPTZ     NOT NULL,
    created_by           VARCHAR(100),
    updated_by           VARCHAR(100),
    base_currency_code   VARCHAR(10)     NOT NULL,
    quote_currency_code  VARCHAR(10)     NOT NULL,
    fee_type             VARCHAR(16)     NOT NULL,
    fee_value            NUMERIC(28, 12) NOT NULL,
    min_amount           NUMERIC(28, 12) NOT NULL,
    max_amount           NUMERIC(28, 12),
    active               BOOLEAN         NOT NULL DEFAULT TRUE,
    CONSTRAINT chk_instantex_fee_tiers_type CHECK (fee_type IN ('FIXED', 'PERCENTAGE')),
    CONSTRAINT chk_instantex_fee_tiers_value CHECK (fee_value > 0),
    CONSTRAINT chk_instantex_fee_tiers_min CHECK (min_amount >= 0),
    CONSTRAINT chk_instantex_fee_tiers_range CHECK (max_amount IS NULL OR max_amount >= min_amount),
    CONSTRAINT chk_instantex_fee_tiers_pair CHECK (base_currency_code <> quote_currency_code),
    CONSTRAINT chk_instantex_fee_tiers_pct CHECK (
        fee_type <> 'PERCENTAGE' OR fee_value <= 100
    ),
    CONSTRAINT fk_instantex_fee_tiers_base
        FOREIGN KEY (base_currency_code) REFERENCES currencies (code),
    CONSTRAINT fk_instantex_fee_tiers_quote
        FOREIGN KEY (quote_currency_code) REFERENCES currencies (code)
);

CREATE INDEX IF NOT EXISTS idx_instantex_fee_tiers_pair_active
    ON instantex_fee_tiers (base_currency_code, quote_currency_code, active, min_amount);
