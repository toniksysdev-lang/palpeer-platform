-- Provider integration: ComplyCube KYC + Apaylo CAD + Kuda NGN rails

ALTER TABLE kyc_cases
    ADD COLUMN IF NOT EXISTS provider_name VARCHAR(40),
    ADD COLUMN IF NOT EXISTS provider_client_id VARCHAR(120),
    ADD COLUMN IF NOT EXISTS provider_check_id VARCHAR(120);

CREATE INDEX IF NOT EXISTS idx_kyc_cases_provider_client ON kyc_cases (provider_client_id);
CREATE INDEX IF NOT EXISTS idx_kyc_cases_provider_check ON kyc_cases (provider_check_id);

ALTER TABLE kyc_documents
    ADD COLUMN IF NOT EXISTS provider_document_id VARCHAR(120);

ALTER TABLE kyc_selfies
    ADD COLUMN IF NOT EXISTS provider_live_photo_id VARCHAR(120);

ALTER TABLE funding_transactions
    ADD COLUMN IF NOT EXISTS provider_name VARCHAR(40),
    ADD COLUMN IF NOT EXISTS funding_instructions TEXT;

CREATE INDEX IF NOT EXISTS idx_funding_provider_ref
    ON funding_transactions (provider_name, provider_reference);

ALTER TABLE withdrawal_transactions
    ADD COLUMN IF NOT EXISTS provider_name VARCHAR(40),
    ADD COLUMN IF NOT EXISTS provider_reference VARCHAR(120);

CREATE INDEX IF NOT EXISTS idx_withdrawal_provider_ref
    ON withdrawal_transactions (provider_name, provider_reference);

CREATE TABLE IF NOT EXISTS payment_virtual_accounts (
    id                  UUID          NOT NULL PRIMARY KEY,
    created_at          TIMESTAMPTZ   NOT NULL,
    updated_at          TIMESTAMPTZ   NOT NULL,
    created_by          VARCHAR(100),
    updated_by          VARCHAR(100),
    user_id             UUID          NOT NULL,
    wallet_id           UUID          NOT NULL,
    currency_code       VARCHAR(10)   NOT NULL,
    provider_name       VARCHAR(40)   NOT NULL,
    tracking_reference  VARCHAR(120)  NOT NULL,
    account_number      VARCHAR(40),
    account_name        VARCHAR(160),
    bank_code           VARCHAR(20),
    bank_name           VARCHAR(120),
    active              BOOLEAN       NOT NULL DEFAULT TRUE,
    CONSTRAINT uk_pva_wallet_provider UNIQUE (wallet_id, provider_name),
    CONSTRAINT uk_pva_tracking UNIQUE (provider_name, tracking_reference),
    CONSTRAINT fk_pva_user FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT fk_pva_wallet FOREIGN KEY (wallet_id) REFERENCES wallets (id)
);

CREATE INDEX IF NOT EXISTS idx_pva_user ON payment_virtual_accounts (user_id);
