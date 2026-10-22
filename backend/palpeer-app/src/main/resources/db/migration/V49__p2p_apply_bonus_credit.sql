-- Buyer opt-in: apply PENDING referral/promo bonus credit toward the P2P platform fee.
ALTER TABLE p2p_requests
    ADD COLUMN IF NOT EXISTS apply_bonus_credit BOOLEAN NOT NULL DEFAULT FALSE;
