-- Expand admin permission catalog to Read / Edit (:write) / Delete / other actions
-- covering all admin-end modules. Existing codes are left untouched (ON CONFLICT).

INSERT INTO admin_permissions (id, created_at, updated_at, code, description)
VALUES
    ('a1000000-0000-0000-0000-000000000020', NOW(), NOW(), 'users:delete', 'Remove or hard-disable user records'),
    ('a1000000-0000-0000-0000-000000000021', NOW(), NOW(), 'kyc:write', 'Update KYC case metadata'),
    ('a1000000-0000-0000-0000-000000000022', NOW(), NOW(), 'kyc:delete', 'Remove KYC artifacts or cases'),
    ('a1000000-0000-0000-0000-000000000023', NOW(), NOW(), 'wallets:write', 'Adjust wallet / pool settings'),
    ('a1000000-0000-0000-0000-000000000024', NOW(), NOW(), 'wallets:delete', 'Remove wallet-side operational records'),
    ('a1000000-0000-0000-0000-000000000025', NOW(), NOW(), 'rates:read', 'View FX rates and bounds'),
    ('a1000000-0000-0000-0000-000000000026', NOW(), NOW(), 'rates:delete', 'Remove rate channels or drafts'),
    ('a1000000-0000-0000-0000-000000000027', NOW(), NOW(), 'transactions:write', 'Annotate or adjust transaction records'),
    ('a1000000-0000-0000-0000-000000000028', NOW(), NOW(), 'transactions:delete', 'Remove transaction artifacts'),
    ('a1000000-0000-0000-0000-000000000029', NOW(), NOW(), 'p2p:delete', 'Remove P2P listings'),
    ('a1000000-0000-0000-0000-00000000002a', NOW(), NOW(), 'fees:delete', 'Remove fee tiers'),
    ('a1000000-0000-0000-0000-00000000002b', NOW(), NOW(), 'negotiations:delete', 'Remove negotiation records'),
    ('a1000000-0000-0000-0000-00000000002c', NOW(), NOW(), 'chat:write', 'Moderate or send as operator'),
    ('a1000000-0000-0000-0000-00000000002d', NOW(), NOW(), 'chat:delete', 'Delete chat messages or rooms'),
    ('a1000000-0000-0000-0000-00000000002e', NOW(), NOW(), 'cards:delete', 'Remove card records'),
    ('a1000000-0000-0000-0000-00000000002f', NOW(), NOW(), 'notifications:delete', 'Remove notification records'),
    ('a1000000-0000-0000-0000-000000000030', NOW(), NOW(), 'promotions:read', 'View promotions, ads, and referrals'),
    ('a1000000-0000-0000-0000-000000000031', NOW(), NOW(), 'promotions:delete', 'Remove promotions or adverts'),
    ('a1000000-0000-0000-0000-000000000032', NOW(), NOW(), 'reports:write', 'Configure report jobs'),
    ('a1000000-0000-0000-0000-000000000033', NOW(), NOW(), 'reports:delete', 'Remove saved report exports'),
    ('a1000000-0000-0000-0000-000000000034', NOW(), NOW(), 'audit:write', 'Annotate audit entries'),
    ('a1000000-0000-0000-0000-000000000035', NOW(), NOW(), 'audit:delete', 'Purge audit retention (ops)'),
    ('a1000000-0000-0000-0000-000000000036', NOW(), NOW(), 'admin:read', 'View admin operators and RBAC catalog'),
    ('a1000000-0000-0000-0000-000000000037', NOW(), NOW(), 'admin:delete', 'Delete admin operators or roles'),
    ('a1000000-0000-0000-0000-000000000038', NOW(), NOW(), 'settings:read', 'View platform settings'),
    ('a1000000-0000-0000-0000-000000000039', NOW(), NOW(), 'settings:write', 'Update platform settings'),
    ('a1000000-0000-0000-0000-00000000003a', NOW(), NOW(), 'dashboard:read', 'View admin dashboard aggregates')
ON CONFLICT (code) DO NOTHING;

INSERT INTO admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM admin_roles r
CROSS JOIN admin_permissions p
WHERE r.code = 'SUPER_ADMIN'
  AND p.code IN (
      'users:delete',
      'kyc:write',
      'kyc:delete',
      'wallets:write',
      'wallets:delete',
      'rates:read',
      'rates:delete',
      'transactions:write',
      'transactions:delete',
      'p2p:delete',
      'fees:delete',
      'negotiations:delete',
      'chat:write',
      'chat:delete',
      'cards:delete',
      'notifications:delete',
      'promotions:read',
      'promotions:delete',
      'reports:write',
      'reports:delete',
      'audit:write',
      'audit:delete',
      'admin:read',
      'admin:delete',
      'settings:read',
      'settings:write',
      'dashboard:read'
  )
ON CONFLICT DO NOTHING;
