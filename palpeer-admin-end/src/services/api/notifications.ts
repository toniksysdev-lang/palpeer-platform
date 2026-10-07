import { apiRequest } from '@/services/api/client';
import type { SpringPage } from '@/types/admin';
import { ApiClientError } from '@/types/api';
import type { NotificationSummary } from '@/types/notifications';

export type AdminNotificationListParams = {
  page?: number;
  size?: number;
  sort?: string;
};

export async function listAdminNotifications(
  params: AdminNotificationListParams = {},
): Promise<SpringPage<NotificationSummary>> {
  const search = new URLSearchParams({
    page: String(params.page ?? 0),
    size: String(params.size ?? 20),
  });
  if (params.sort) search.set('sort', params.sort);
  return apiRequest<SpringPage<NotificationSummary>>(
    `/admin/notifications?${search.toString()}`,
  );
}

/** Broadcast/send remains CONTRACT_PENDING (P12-06). */
export async function broadcastAdminNotification(): Promise<never> {
  throw new ApiClientError(
    501,
    'CONTRACT_PENDING',
    'Admin notification broadcast/send API is not verified.',
  );
}
