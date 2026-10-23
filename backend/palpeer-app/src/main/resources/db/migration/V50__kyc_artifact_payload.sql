-- Persist KYC image bytes in Postgres so verification still works when the
-- local filesystem is ephemeral (e.g. Render free tier redeploys / cold starts).

ALTER TABLE kyc_documents
    ADD COLUMN IF NOT EXISTS payload BYTEA;

ALTER TABLE kyc_selfies
    ADD COLUMN IF NOT EXISTS payload BYTEA;
