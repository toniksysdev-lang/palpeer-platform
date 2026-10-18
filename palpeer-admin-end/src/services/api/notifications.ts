import { apiRequest } from '@/services/api/client';
import type { SpringPage } from '@/types/admin';
import type {
  BroadcastPushInput,
  BroadcastPushResult,
  NotificationSummary,
} from '@/types/notifications';

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

export async function broadcastAdminNotification(
  input: BroadcastPushInput,
): Promise<BroadcastPushResult> {
  return apiRequest<BroadcastPushResult>('/admin/notifications/broadcast', {
    method: 'POST',
    body: {
      title: input.title.trim(),
      body: input.body.trim(),
      category: input.category?.trim() || 'ADMIN',
    },
  });
}
