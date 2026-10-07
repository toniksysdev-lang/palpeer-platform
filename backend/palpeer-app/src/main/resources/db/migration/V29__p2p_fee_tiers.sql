-- P2P exchange fee tiers: fixed amount or percentage within amount ranges.

CREATE TABLE IF NOT EXISTS p2p_fee_tiers (
    id                   UUID            NOT NULL PRIMARY KEY,
    created_at           TIMESTAMPTZ     NOT NULL,
    updated_at           TIMESTAMPTZ     NOT NULL,
    created_by           VARCHAR(100),
    updated_by           VARCHAR(100),
    base_currency_code   VARCHAR(10)     NOT NULL,
    quote_currency_code  VARCHAR(10)     NOT NULL,
    fee_type             VARCHAR(16)     NOT NULL,
    fee_value            NUMERIC(28, 12) NOT NULL,
    min_amount           NUMERIC(28, 12) NOT NULL,
    max_amount           NUMERIC(28, 12),
    active               BOOLEAN         NOT NULL DEFAULT TRUE,
    CONSTRAINT chk_p2p_fee_tiers_type CHECK (fee_type IN ('FIXED', 'PERCENTAGE')),
    CONSTRAINT chk_p2p_fee_tiers_value CHECK (fee_value > 0),
    CONSTRAINT chk_p2p_fee_tiers_min CHECK (min_amount >= 0),
    CONSTRAINT chk_p2p_fee_tiers_range CHECK (max_amount IS NULL OR max_amount >= min_amount),
    CONSTRAINT chk_p2p_fee_tiers_pair CHECK (base_currency_code <> quote_currency_code),
    CONSTRAINT chk_p2p_fee_tiers_pct CHECK (
        fee_type <> 'PERCENTAGE' OR fee_value <= 100
    ),
    CONSTRAINT fk_p2p_fee_tiers_base
        FOREIGN KEY (base_currency_code) REFERENCES currencies (code),
    CONSTRAINT fk_p2p_fee_tiers_quote
        FOREIGN KEY (quote_currency_code) REFERENCES currencies (code)
);

CREATE INDEX IF NOT EXISTS idx_p2p_fee_tiers_pair_active
    ON p2p_fee_tiers (base_currency_code, quote_currency_code, active, min_amount);

INSERT INTO admin_permissions (id, created_at, updated_at, code, description)
VALUES
    ('a1000000-0000-0000-0000-000000000017', NOW(), NOW(), 'fees:read', 'View fee management schedules'),
    ('a1000000-0000-0000-0000-000000000018', NOW(), NOW(), 'fees:write', 'Create/update/delete fee schedules')
ON CONFLICT (code) DO NOTHING;

INSERT INTO admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM admin_roles r
CROSS JOIN admin_permissions p
WHERE r.code = 'SUPER_ADMIN'
  AND p.code IN ('fees:read', 'fees:write')
ON CONFLICT DO NOTHING;
