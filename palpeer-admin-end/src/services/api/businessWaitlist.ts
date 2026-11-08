import { apiRequest } from '@/services/api/client';
import type {
  BusinessInterest,
  DeleteBusinessInterestsResult,
  SendBusinessInterestEmailInput,
  SendBusinessInterestEmailResult,
} from '@/types/businessWaitlist';

export async function listBusinessInterests(): Promise<BusinessInterest[]> {
  return apiRequest<BusinessInterest[]>('/admin/business-account-interests');
}

export async function sendBusinessInterestEmail(
  input: SendBusinessInterestEmailInput,
): Promise<SendBusinessInterestEmailResult> {
  return apiRequest<SendBusinessInterestEmailResult>(
    '/admin/business-account-interests/send-email',
    {
      method: 'POST',
      body: {
        subject: input.subject.trim(),
        body: input.body.trim(),
        all: input.all ?? false,
        ids: input.all ? undefined : input.ids,
      },
    },
  );
}

export async function deleteBusinessInterest(id: string): Promise<void> {
  await apiRequest<void>(`/admin/business-account-interests/${id}`, { method: 'DELETE' });
}

export async function deleteBusinessInterests(
  ids: string[],
): Promise<DeleteBusinessInterestsResult> {
  return apiRequest<DeleteBusinessInterestsResult>('/admin/business-account-interests/delete', {
    method: 'POST',
    body: { ids },
  });
}
