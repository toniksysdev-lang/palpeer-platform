-- Admin ops v2: reports:read permission for /admin/reports/** (summary + CSV exports)

INSERT INTO admin_permissions (id, created_at, updated_at, code, description)
VALUES ('a1000000-0000-0000-0000-000000000013', NOW(), NOW(), 'reports:read', 'View admin reports and export CSV datasets')
ON CONFLICT (code) DO NOTHING;

INSERT INTO admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM admin_roles r
CROSS JOIN admin_permissions p
WHERE r.code = 'SUPER_ADMIN'
  AND p.code = 'reports:read'
ON CONFLICT DO NOTHING;
