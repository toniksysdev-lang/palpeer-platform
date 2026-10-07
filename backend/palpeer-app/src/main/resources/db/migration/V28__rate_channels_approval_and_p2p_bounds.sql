-- InstantEX (SWAP) vs P2P published rates, activation, approval, and P2P post bounds.

ALTER TABLE exchange_rates
    ADD COLUMN IF NOT EXISTS channel VARCHAR(16) NOT NULL DEFAULT 'SWAP',
    ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS approval_status VARCHAR(16) NOT NULL DEFAULT 'APPROVED';

ALTER TABLE exchange_rates DROP CONSTRAINT IF EXISTS uk_exchange_rates_pair_effective;

ALTER TABLE exchange_rates
    ADD CONSTRAINT uk_exchange_rates_pair_channel_effective
        UNIQUE (base_currency_code, quote_currency_code, channel, effective_date);

ALTER TABLE exchange_rates DROP CONSTRAINT IF EXISTS chk_exchange_rates_channel;
ALTER TABLE exchange_rates
    ADD CONSTRAINT chk_exchange_rates_channel CHECK (channel IN ('SWAP', 'P2P'));

ALTER TABLE exchange_rates DROP CONSTRAINT IF EXISTS chk_exchange_rates_approval;
ALTER TABLE exchange_rates
    ADD CONSTRAINT chk_exchange_rates_approval
        CHECK (approval_status IN ('PENDING', 'APPROVED', 'REJECTED'));

CREATE INDEX IF NOT EXISTS idx_exchange_rates_channel_active
    ON exchange_rates (channel, active, approval_status, effective_date DESC);

-- Min/max rate a user may post when creating/updating a P2P request for a pair.
CREATE TABLE IF NOT EXISTS p2p_rate_bounds (
    id                   UUID            NOT NULL PRIMARY KEY,
    created_at           TIMESTAMPTZ     NOT NULL,
    updated_at           TIMESTAMPTZ     NOT NULL,
    created_by           VARCHAR(100),
    updated_by           VARCHAR(100),
    base_currency_code   VARCHAR(10)     NOT NULL,
    quote_currency_code  VARCHAR(10)     NOT NULL,
    min_rate             NUMERIC(28, 12) NOT NULL,
    max_rate             NUMERIC(28, 12) NOT NULL,
    CONSTRAINT uk_p2p_rate_bounds_pair UNIQUE (base_currency_code, quote_currency_code),
    CONSTRAINT chk_p2p_rate_bounds_positive CHECK (min_rate > 0 AND max_rate > 0),
    CONSTRAINT chk_p2p_rate_bounds_order CHECK (min_rate <= max_rate),
    CONSTRAINT chk_p2p_rate_bounds_pair CHECK (base_currency_code <> quote_currency_code),
    CONSTRAINT fk_p2p_rate_bounds_base
        FOREIGN KEY (base_currency_code) REFERENCES currencies (code),
    CONSTRAINT fk_p2p_rate_bounds_quote
        FOREIGN KEY (quote_currency_code) REFERENCES currencies (code)
);
