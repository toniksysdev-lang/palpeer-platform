-- Phase 11: indexes for cross-product transaction history queries

CREATE INDEX IF NOT EXISTS idx_funding_user_created
    ON funding_transactions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_withdrawal_user_created
    ON withdrawal_transactions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_exchange_tx_user_created
    ON exchange_transactions (user_id, created_at DESC);
