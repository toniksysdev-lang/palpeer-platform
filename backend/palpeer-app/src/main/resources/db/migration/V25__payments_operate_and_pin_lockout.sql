-- Security hardening:
-- 1. payments:operate gates manual funding/withdrawal process/fail/reverse (previously any owner could self-credit).
-- 2. PIN attempt lockout state on pin_credentials.

INSERT INTO admin_permissions (id, created_at, updated_at, code, description)
VALUES ('a1000000-0000-0000-0000-000000000016', NOW(), NOW(), 'payments:operate',
        'Manually process, fail or reverse funding and withdrawal transactions')
ON CONFLICT (code) DO NOTHING;

INSERT INTO admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM admin_roles r
CROSS JOIN admin_permissions p
WHERE r.code = 'SUPER_ADMIN'
  AND p.code = 'payments:operate'
ON CONFLICT DO NOTHING;

ALTER TABLE pin_credentials ADD COLUMN failed_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE pin_credentials ADD COLUMN locked_until TIMESTAMPTZ;
