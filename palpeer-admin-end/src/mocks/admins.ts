import { ApiClientError } from '@/types/api';
import type { AdminOperator } from '@/types/admin';
import type { AssignAdminInput } from '@/services/api/admins';

const operators: AdminOperator[] = [
  {
    id: 'admin-1',
    userId: '00000000-0000-4000-8000-000000000001',
    enabled: true,
    roleCodes: ['SUPER_ADMIN'],
  },
  {
    id: 'admin-2',
    userId: 'u-3',
    enabled: true,
    roleCodes: ['SUPER_ADMIN'],
  },
];

export function mockListAdmins(): AdminOperator[] {
  return operators.map((row) => ({ ...row, roleCodes: [...row.roleCodes] }));
}

export function mockAssignAdmin(input: AssignAdminInput): AdminOperator {
  if (!input.userId?.trim() || !input.roleCodes?.length) {
    throw new ApiClientError(400, 'VALIDATION_ERROR', 'userId and roleCodes are required.');
  }
  const existing = operators.find((row) => row.userId === input.userId);
  if (existing) {
    existing.enabled = true;
    existing.roleCodes = [...input.roleCodes];
    return { ...existing, roleCodes: [...existing.roleCodes] };
  }
  const created: AdminOperator = {
    id: `admin-${operators.length + 1}`,
    userId: input.userId,
    enabled: true,
    roleCodes: [...input.roleCodes],
  };
  operators.push(created);
  return { ...created, roleCodes: [...created.roleCodes] };
}

export function mockDisableAdmin(userId: string): AdminOperator {
  const found = operators.find((row) => row.userId === userId);
  if (!found) {
    throw new ApiClientError(404, 'RESOURCE_NOT_FOUND', 'Admin operator not found.');
  }
  found.enabled = false;
  return { ...found, roleCodes: [...found.roleCodes] };
}
