/** Seeded backend permission codes (Flyway V19–V25). */
export const KNOWN_PERMISSIONS = [
  'users:read',
  'users:write',
  'kyc:read',
  'kyc:review',
  'rates:write',
  'currencies:write',
  'transactions:read',
  'p2p:read',
  'p2p:write',
  'promotions:write',
  'admin:manage',
  'audit:read',
  'wallets:read',
  'cards:read',
  'cards:write',
  'negotiations:read',
  'chat:read',
  'notifications:read',
  'reports:read',
  'fees:read',
  'fees:write',
  'users:notes:read',
  'users:notes:write',
  'payments:operate',
] as const;

export type PermissionCode = (typeof KNOWN_PERMISSIONS)[number] | (string & {});

/**
 * Frontend permission check. Backend remains authoritative.
 *
 * When permissions are unknown, returns true for ROLE_ADMIN sessions so navigation
 * stays usable; API calls still enforce RBAC. Live sessions resolve codes via GET /admin/me.
 */
export function can(
  permissions: readonly string[] | 'unknown',
  permission?: string,
  options?: { isAdmin?: boolean },
): boolean {
  if (!permission) return true;
  if (permissions === 'unknown') {
    return Boolean(options?.isAdmin);
  }
  return permissions.includes(permission);
}
