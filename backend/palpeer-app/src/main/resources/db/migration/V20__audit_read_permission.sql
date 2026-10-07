-- Phase 16: audit:read permission for admin audit log query

INSERT INTO admin_permissions (id, created_at, updated_at, code, description)
VALUES ('a1000000-0000-0000-0000-00000000000c', NOW(), NOW(), 'audit:read', 'Search audit logs')
ON CONFLICT (code) DO NOTHING;

INSERT INTO admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM admin_roles r
CROSS JOIN admin_permissions p
WHERE r.code = 'SUPER_ADMIN'
  AND p.code = 'audit:read'
ON CONFLICT DO NOTHING;
