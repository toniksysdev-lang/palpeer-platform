-- Allow admins to broadcast push messages to all users

INSERT INTO admin_permissions (id, created_at, updated_at, code, description)
VALUES
    ('a1000000-0000-0000-0000-000000000019', NOW(), NOW(), 'notifications:write', 'Broadcast push notifications to users')
ON CONFLICT (code) DO NOTHING;

INSERT INTO admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM admin_roles r
CROSS JOIN admin_permissions p
WHERE r.code = 'SUPER_ADMIN'
  AND p.code = 'notifications:write'
ON CONFLICT DO NOTHING;
