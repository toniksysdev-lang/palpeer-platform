-- Persist assessed P2P platform fees on settled orders (base-currency amount).
ALTER TABLE p2p_orders
    ADD COLUMN IF NOT EXISTS fee_amount NUMERIC(28, 12),
    ADD COLUMN IF NOT EXISTS fee_currency_code VARCHAR(10);

ALTER TABLE p2p_orders
    DROP CONSTRAINT IF EXISTS chk_p2p_orders_fee_non_negative;

ALTER TABLE p2p_orders
    ADD CONSTRAINT chk_p2p_orders_fee_non_negative
        CHECK (fee_amount IS NULL OR fee_amount >= 0);
