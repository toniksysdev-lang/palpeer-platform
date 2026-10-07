import { ApiClientError } from '@/types/api';
import type { AdminPermission, AdminRole } from '@/types/admin';
import type { CreatePermissionInput, CreateRoleInput, UpdateRoleInput } from '@/services/api/rbac';

const permissions: AdminPermission[] = [
  {
    id: 'perm-1',
    code: 'users:read',
    description: 'List/view users',
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'perm-2',
    code: 'users:write',
    description: 'Update user status/enabled',
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'perm-3',
    code: 'admin:manage',
    description: 'Manage admin users/roles',
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'perm-4',
    code: 'audit:read',
    description: 'Read audit logs',
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'perm-5',
    code: 'reports:read',
    description: 'Read reports and export CSV datasets',
    createdAt: '2026-01-01T00:00:00Z',
  },
];

const roles: AdminRole[] = [
  {
    id: 'role-1',
    code: 'SUPER_ADMIN',
    name: 'Super Admin',
    description: 'Full admin access',
    permissionCodes: permissions.map((p) => p.code),
    createdAt: '2026-01-01T00:00:00Z',
  },
];

export function mockListPermissions(): AdminPermission[] {
  return permissions.map((row) => ({ ...row }));
}

export function mockCreatePermission(input: CreatePermissionInput): AdminPermission {
  const code = input.code.trim().toLowerCase();
  if (permissions.some((row) => row.code === code)) {
    throw new ApiClientError(409, 'PERMISSION_EXISTS', `Permission already exists: ${code}`);
  }
  const created: AdminPermission = {
    id: `perm-${permissions.length + 1}`,
    code,
    description: input.description ?? null,
    createdAt: new Date().toISOString(),
  };
  permissions.push(created);
  return { ...created };
}

export function mockListRoles(): AdminRole[] {
  return roles.map((row) => ({ ...row, permissionCodes: [...row.permissionCodes] }));
}

export function mockGetRole(code: string): AdminRole {
  const found = roles.find((row) => row.code === code.toUpperCase());
  if (!found) {
    throw new ApiClientError(404, 'RESOURCE_NOT_FOUND', `Role not found: ${code}`);
  }
  return { ...found, permissionCodes: [...found.permissionCodes] };
}

export function mockCreateRole(input: CreateRoleInput): AdminRole {
  const code = input.code.trim().toUpperCase();
  if (roles.some((row) => row.code === code)) {
    throw new ApiClientError(409, 'ROLE_EXISTS', `Role already exists: ${code}`);
  }
  for (const permissionCode of input.permissionCodes) {
    if (!permissions.some((row) => row.code === permissionCode)) {
      throw new ApiClientError(404, 'RESOURCE_NOT_FOUND', `Permission not found: ${permissionCode}`);
    }
  }
  const created: AdminRole = {
    id: `role-${roles.length + 1}`,
    code,
    name: input.name,
    description: input.description ?? null,
    permissionCodes: [...input.permissionCodes],
    createdAt: new Date().toISOString(),
  };
  roles.push(created);
  return { ...created, permissionCodes: [...created.permissionCodes] };
}

export function mockUpdateRole(code: string, input: UpdateRoleInput): AdminRole {
  const found = roles.find((row) => row.code === code.toUpperCase());
  if (!found) {
    throw new ApiClientError(404, 'RESOURCE_NOT_FOUND', `Role not found: ${code}`);
  }
  if (input.name) found.name = input.name;
  if (input.description !== undefined) found.description = input.description;
  if (input.permissionCodes) {
    if (found.code === 'SUPER_ADMIN' && !input.permissionCodes.includes('admin:manage')) {
      throw new ApiClientError(400, 'SUPER_ADMIN_LOCKED', 'SUPER_ADMIN must retain admin:manage');
    }
    found.permissionCodes = [...input.permissionCodes];
  }
  return { ...found, permissionCodes: [...found.permissionCodes] };
}
