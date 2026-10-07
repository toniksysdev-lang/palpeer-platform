import { apiRequest } from '@/services/api/client';
import type { AdminOperator } from '@/types/admin';

export type AssignAdminInput = {
  userId: string;
  roleCodes: string[];
};

export async function listAdmins(): Promise<AdminOperator[]> {
  return apiRequest<AdminOperator[]>('/admin/admins');
}

export async function assignAdmin(input: AssignAdminInput): Promise<AdminOperator> {
  return apiRequest<AdminOperator>('/admin/admins', {
    method: 'POST',
    body: input,
  });
}

export async function disableAdmin(userId: string): Promise<AdminOperator> {
  return apiRequest<AdminOperator>(`/admin/admins/${userId}/disable`, {
    method: 'POST',
  });
}
