import { CATALOG_PERMISSION_CODES } from '@/lib/permissionCatalog';

/**
 * Seeded / catalog permission codes used by Roles, Permissions UIs, and mocks.
 * Prefer {@link CATALOG_PERMISSION_CODES} for the full module matrix.
 */
export const KNOWN_PERMISSIONS = CATALOG_PERMISSION_CODES;

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
