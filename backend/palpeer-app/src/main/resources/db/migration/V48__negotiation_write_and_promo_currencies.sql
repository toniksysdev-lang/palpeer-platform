-- Admin can force-cancel / force-accept negotiations.
INSERT INTO admin_permissions (id, created_at, updated_at, code, description)
VALUES (
    'a1000000-0000-0000-0000-000000000048',
    NOW(),
    NOW(),
    'negotiations:write',
    'Force-cancel or force-accept negotiations'
)
ON CONFLICT (code) DO NOTHING;

INSERT INTO admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM admin_roles r
CROSS JOIN admin_permissions p
WHERE r.code = 'SUPER_ADMIN'
  AND p.code = 'negotiations:write'
ON CONFLICT DO NOTHING;

-- Allow multiple bonus currencies on a promotion (CSV of ISO codes).
ALTER TABLE promotions DROP CONSTRAINT IF EXISTS fk_promotions_currency;

ALTER TABLE promotions
    ALTER COLUMN bonus_currency_code TYPE VARCHAR(200);