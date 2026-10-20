-- Max cumulative SUCCESS funding amount allowed without APPROVED identity (KYC), per wallet currency.

CREATE TABLE IF NOT EXISTS funding_unverified_limits (
    id                  UUID PRIMARY KEY,
    created_at          TIMESTAMPTZ NOT NULL,
    updated_at          TIMESTAMPTZ NOT NULL,
    created_by          VARCHAR(120),
    updated_by          VARCHAR(120),
    currency_code       VARCHAR(3) NOT NULL,
    max_amount          NUMERIC(19, 4) NOT NULL,
    CONSTRAINT uq_funding_unverified_limits_ccy UNIQUE (currency_code),
    CONSTRAINT chk_funding_unverified_limits_amount CHECK (max_amount >= 0)
);
