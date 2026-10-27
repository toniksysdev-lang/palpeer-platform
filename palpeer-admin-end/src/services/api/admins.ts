import { apiRequest } from '@/services/api/client';
import type { AdminOperator } from '@/types/admin';

export type AssignAdminInput = {
  userId: string;
  roleCodes: string[];
};

export type CreateAdminInput = {
  email: string;
  password?: string;
  roleCodes: string[];
  sendInviteEmail?: boolean;
};

export type CreateAdminResult = {
  admin: AdminOperator;
  temporaryPassword: string;
  inviteEmailSent: boolean;
};

export type UpdateAdminInput = {
  roleCodes?: string[];
  enabled?: boolean;
  resetPassword?: boolean;
};

export async function listAdmins(): Promise<AdminOperator[]> {
  return apiRequest<AdminOperator[]>('/admin/admins');
}

export async function createAdmin(input: CreateAdminInput): Promise<CreateAdminResult> {
  return apiRequest<CreateAdminResult>('/admin/admins', {
    method: 'POST',
    body: {
      email: input.email.trim(),
      password: input.password?.trim() ? input.password.trim() : null,
      roleCodes: input.roleCodes,
      sendInviteEmail: input.sendInviteEmail ?? true,
    },
  });
}

/** @deprecated Prefer {@link createAdmin}; kept for UUID-based promotion. */
export async function assignAdmin(input: AssignAdminInput): Promise<AdminOperator> {
  return apiRequest<AdminOperator>('/admin/admins/assign', {
    method: 'POST',
    body: input,
  });
}

export async function updateAdmin(userId: string, input: UpdateAdminInput): Promise<AdminOperator> {
  return apiRequest<AdminOperator>(`/admin/admins/${userId}`, {
    method: 'PUT',
    body: input,
  });
}

export async function disableAdmin(userId: string): Promise<AdminOperator> {
  return apiRequest<AdminOperator>(`/admin/admins/${userId}/disable`, {
    method: 'POST',
  });
}

export async function deleteAdmin(userId: string): Promise<void> {
  await apiRequest<null>(`/admin/admins/${userId}`, {
    method: 'DELETE',
  });
}
