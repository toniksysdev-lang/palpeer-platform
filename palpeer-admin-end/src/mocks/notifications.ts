import type { SpringPage } from '@/types/admin';
import type { NotificationSummary } from '@/types/notifications';

const now = Date.now();

const catalog: NotificationSummary[] = [
  {
    id: 'ntf-1',
    title: 'KYC approved',
    body: 'Your identity verification was approved.',
    category: 'KYC',
    channel: 'PUSH',
    status: 'SENT',
    referenceType: 'KYC_CASE',
    referenceId: 'kyc-1',
    readAt: null,
    sentAt: new Date(now - 3600000).toISOString(),
    failureReason: null,
    createdAt: new Date(now - 3600000).toISOString(),
  },
  {
    id: 'ntf-2',
    title: 'P2P order completed',
    body: 'Your P2P order has completed.',
    category: 'P2P',
    channel: 'IN_APP',
    status: 'READ',
    referenceType: 'P2P_ORDER',
    referenceId: 'ord-1',
    readAt: new Date(now - 1800000).toISOString(),
    sentAt: new Date(now - 7200000).toISOString(),
    failureReason: null,
    createdAt: new Date(now - 7200000).toISOString(),
  },
];

function toPage<T>(rows: T[], page: number, size: number): SpringPage<T> {
  const start = page * size;
  const content = rows.slice(start, start + size);
  const totalElements = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalElements / size) || 1);
  return {
    content,
    totalElements,
    totalPages,
    size,
    number: page,
    numberOfElements: content.length,
    first: page === 0,
    last: page >= totalPages - 1,
    empty: content.length === 0,
  };
}

export function mockListNotifications(params?: {
  page?: number;
  size?: number;
}): SpringPage<NotificationSummary> {
  return toPage(
    catalog.map((row) => ({ ...row })),
    params?.page ?? 0,
    params?.size ?? 20,
  );
}
