-- Phase 4: currencies and exchange rates

CREATE TABLE currencies (
    id               UUID            NOT NULL PRIMARY KEY,
    created_at       TIMESTAMPTZ     NOT NULL,
    updated_at       TIMESTAMPTZ     NOT NULL,
    created_by       VARCHAR(100),
    updated_by       VARCHAR(100),
    code             VARCHAR(10)     NOT NULL,
    symbol           VARCHAR(10)     NOT NULL,
    precision        INTEGER         NOT NULL,
    CONSTRAINT uk_currencies_code UNIQUE (code),
    CONSTRAINT chk_currencies_precision CHECK (precision >= 0 AND precision <= 18)
);

CREATE TABLE exchange_rates (
    id                   UUID            NOT NULL PRIMARY KEY,
    created_at           TIMESTAMPTZ     NOT NULL,
    updated_at           TIMESTAMPTZ     NOT NULL,
    created_by           VARCHAR(100),
    updated_by           VARCHAR(100),
    base_currency_code   VARCHAR(10)     NOT NULL,
    quote_currency_code  VARCHAR(10)     NOT NULL,
    buy_rate             NUMERIC(28, 12) NOT NULL,
    sell_rate            NUMERIC(28, 12) NOT NULL,
    effective_date       TIMESTAMPTZ     NOT NULL,
    CONSTRAINT uk_exchange_rates_pair_effective
        UNIQUE (base_currency_code, quote_currency_code, effective_date),
    CONSTRAINT chk_exchange_rates_positive
        CHECK (buy_rate > 0 AND sell_rate > 0),
    CONSTRAINT chk_exchange_rates_pair
        CHECK (base_currency_code <> quote_currency_code),
    CONSTRAINT fk_exchange_rates_base
        FOREIGN KEY (base_currency_code) REFERENCES currencies (code),
    CONSTRAINT fk_exchange_rates_quote
        FOREIGN KEY (quote_currency_code) REFERENCES currencies (code)
);

CREATE INDEX idx_exchange_rates_pair_effective
    ON exchange_rates (base_currency_code, quote_currency_code, effective_date DESC);
