import { apiRequest } from '@/services/api/client';
import type { AdminPermission, AdminRole } from '@/types/admin';

export type CreatePermissionInput = {
  code: string;
  description?: string;
};

export type CreateRoleInput = {
  code: string;
  name: string;
  description?: string;
  permissionCodes: string[];
};

export type UpdateRoleInput = {
  name?: string;
  description?: string | null;
  permissionCodes?: string[];
};

export async function listPermissions(): Promise<AdminPermission[]> {
  return apiRequest<AdminPermission[]>('/admin/permissions');
}

export async function createPermission(input: CreatePermissionInput): Promise<AdminPermission> {
  return apiRequest<AdminPermission>('/admin/permissions', {
    method: 'POST',
    body: input,
  });
}

export async function listRoles(): Promise<AdminRole[]> {
  return apiRequest<AdminRole[]>('/admin/roles');
}

export async function getRole(code: string): Promise<AdminRole> {
  return apiRequest<AdminRole>(`/admin/roles/${encodeURIComponent(code)}`);
}

export async function createRole(input: CreateRoleInput): Promise<AdminRole> {
  return apiRequest<AdminRole>('/admin/roles', {
    method: 'POST',
    body: input,
  });
}

export async function updateRole(code: string, input: UpdateRoleInput): Promise<AdminRole> {
  return apiRequest<AdminRole>(`/admin/roles/${encodeURIComponent(code)}`, {
    method: 'PUT',
    body: input,
  });
}
