-- Emails collected from "Business accounts are not ready yet" waitlist

CREATE TABLE IF NOT EXISTS business_account_interests (
    id              UUID PRIMARY KEY,
    created_at      TIMESTAMPTZ NOT NULL,
    updated_at      TIMESTAMPTZ NOT NULL,
    created_by      VARCHAR(120),
    updated_by      VARCHAR(120),
    email           VARCHAR(320) NOT NULL,
    email_normalized VARCHAR(320) NOT NULL,
    source          VARCHAR(40) NOT NULL DEFAULT 'mobile'
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_business_account_interests_email_normalized
    ON business_account_interests (email_normalized);

CREATE INDEX IF NOT EXISTS idx_business_account_interests_created_at
    ON business_account_interests (created_at DESC);
