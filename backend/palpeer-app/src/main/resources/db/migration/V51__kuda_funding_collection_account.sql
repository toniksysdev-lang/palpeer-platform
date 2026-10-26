-- Per-funding Kuda dynamic collection account (live NGN bank-transfer funding).
ALTER TABLE funding_transactions
    ADD COLUMN IF NOT EXISTS collection_account_number VARCHAR(40),
    ADD COLUMN IF NOT EXISTS collection_account_name VARCHAR(160),
    ADD COLUMN IF NOT EXISTS collection_bank_name VARCHAR(120),
    ADD COLUMN IF NOT EXISTS collection_bank_code VARCHAR(20),
    ADD COLUMN IF NOT EXISTS collection_tracking_ref VARCHAR(120);

CREATE INDEX IF NOT EXISTS idx_funding_collection_account
    ON funding_transactions (provider_name, collection_account_number, status);
