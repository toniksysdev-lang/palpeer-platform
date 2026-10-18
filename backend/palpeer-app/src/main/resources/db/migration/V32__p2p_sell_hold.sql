-- Temporary ledger hold for P2P SELL listings (available → pending until complete/cancel/expire).
ALTER TABLE p2p_requests
    ADD COLUMN IF NOT EXISTS hold_wallet_id UUID,
    ADD COLUMN IF NOT EXISTS hold_ledger_entry_id UUID;
