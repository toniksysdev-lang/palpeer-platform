-- Admin ops inventory permissions (wallets/cards/negotiations/chat/notifications)

INSERT INTO admin_permissions (id, created_at, updated_at, code, description)
VALUES
    ('a1000000-0000-0000-0000-00000000000d', NOW(), NOW(), 'wallets:read', 'List/view wallets and ledger txs'),
    ('a1000000-0000-0000-0000-00000000000e', NOW(), NOW(), 'cards:read', 'List/view cards and card txs'),
    ('a1000000-0000-0000-0000-00000000000f', NOW(), NOW(), 'cards:write', 'Block/unblock cards'),
    ('a1000000-0000-0000-0000-000000000010', NOW(), NOW(), 'negotiations:read', 'List/view negotiations'),
    ('a1000000-0000-0000-0000-000000000011', NOW(), NOW(), 'chat:read', 'List/view chat rooms and messages'),
    ('a1000000-0000-0000-0000-000000000012', NOW(), NOW(), 'notifications:read', 'List notifications across users')
ON CONFLICT (code) DO NOTHING;

INSERT INTO admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM admin_roles r
CROSS JOIN admin_permissions p
WHERE r.code = 'SUPER_ADMIN'
  AND p.code IN (
      'wallets:read',
      'cards:read',
      'cards:write',
      'negotiations:read',
      'chat:read',
      'notifications:read'
  )
ON CONFLICT DO NOTHING;
