import { ApiClientError } from '@/types/api';
import type { AdminOperator } from '@/types/admin';
import type { AssignAdminInput, CreateAdminInput, CreateAdminResult, UpdateAdminInput } from '@/services/api/admins';

const operators: AdminOperator[] = [
  {
    id: 'admin-1',
    userId: '00000000-0000-4000-8000-000000000001',
    email: 'admin@palpeer.local',
    enabled: true,
    roleCodes: ['SUPER_ADMIN'],
  },
  {
    id: 'admin-2',
    userId: 'u-3',
    email: 'ops@palpeer.local',
    enabled: true,
    roleCodes: ['SUPER_ADMIN'],
  },
];

export function mockListAdmins(): AdminOperator[] {
  return operators.map((row) => ({ ...row, roleCodes: [...row.roleCodes] }));
}

export function mockCreateAdmin(input: CreateAdminInput): CreateAdminResult {
  const email = input.email?.trim().toLowerCase();
  if (!email || !input.roleCodes?.length) {
    throw new ApiClientError(400, 'VALIDATION_ERROR', 'email and roleCodes are required.');
  }
  if (operators.some((row) => row.email?.toLowerCase() === email)) {
    throw new ApiClientError(409, 'ADMIN_EXISTS', 'An admin operator already exists for this email.');
  }
  const created: AdminOperator = {
    id: `admin-${operators.length + 1}`,
    userId: crypto.randomUUID(),
    email,
    enabled: true,
    roleCodes: [...input.roleCodes],
  };
  operators.push(created);
  const temporaryPassword = input.password?.trim() || 'TempPass1!mock';
  return {
    admin: { ...created, roleCodes: [...created.roleCodes] },
    temporaryPassword,
    inviteEmailSent: input.sendInviteEmail !== false,
  };
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

export function mockUpdateAdmin(userId: string, input: UpdateAdminInput): AdminOperator {
  const found = operators.find((row) => row.userId === userId);
  if (!found) {
    throw new ApiClientError(404, 'RESOURCE_NOT_FOUND', 'Admin operator not found.');
  }
  if (input.roleCodes) found.roleCodes = [...input.roleCodes];
  if (typeof input.enabled === 'boolean') found.enabled = input.enabled;
  return { ...found, roleCodes: [...found.roleCodes] };
}

export function mockDisableAdmin(userId: string): AdminOperator {
  return mockUpdateAdmin(userId, { enabled: false });
}

export function mockDeleteAdmin(userId: string): void {
  const index = operators.findIndex((row) => row.userId === userId);
  if (index < 0) {
    throw new ApiClientError(404, 'RESOURCE_NOT_FOUND', 'Admin operator not found.');
  }
  operators.splice(index, 1);
}
