import { ApiClientError } from '@/types/api';
import type { P2POrderSummary, P2PRequestSummary } from '@/types/admin';
import type { P2PAdminStatus } from '@/types/p2p';

const now = Date.now();

const requests: P2PRequestSummary[] = [
  {
    id: 'req-1',
    userId: 'u-2',
    side: 'BUY',
    baseCurrencyCode: 'NGN',
    quoteCurrencyCode: 'CAD',
    amount: '150000',
    rate: '1050.25',
    status: 'OPEN',
    expiresAt: new Date(now + 86400000).toISOString(),
    notes: 'Mock open request',
    createdAt: new Date(now - 3600000).toISOString(),
  },
  {
    id: 'req-2',
    userId: 'u-3',
    side: 'SELL',
    baseCurrencyCode: 'CAD',
    quoteCurrencyCode: 'NGN',
    amount: '500',
    rate: '1048.00',
    status: 'ACCEPTED',
    createdAt: new Date(now - 7200000).toISOString(),
  },
  {
    id: 'req-3',
    userId: 'u-4',
    side: 'BUY',
    baseCurrencyCode: 'USD',
    quoteCurrencyCode: 'CAD',
    amount: '200',
    rate: '1.36',
    status: 'COMPLETED',
    createdAt: new Date(now - 86400000 * 2).toISOString(),
  },
];

const orders: P2POrderSummary[] = [
  {
    id: 'ord-1',
    requestId: 'req-2',
    requesterId: 'u-3',
    acceptorId: 'u-5',
    amount: '500',
    rate: '1048.00',
    status: 'ACCEPTED',
    createdAt: new Date(now - 7000000).toISOString(),
  },
  {
    id: 'ord-2',
    requestId: 'req-3',
    requesterId: 'u-4',
    acceptorId: 'u-2',
    amount: '200',
    rate: '1.36',
    status: 'COMPLETED',
    createdAt: new Date(now - 86400000 * 2).toISOString(),
  },
];

export function mockListP2PRequests(params?: {
  status?: string;
  userId?: string;
}): P2PRequestSummary[] {
  return requests
    .filter(
      (row) =>
        (!params?.status || row.status === params.status) &&
        (!params?.userId || row.userId === params.userId),
    )
    .map((row) => ({ ...row }));
}

export function mockListP2POrders(params?: {
  status?: string;
  userId?: string;
}): P2POrderSummary[] {
  const userId = params?.userId;
  return orders
    .filter(
      (row) =>
        (!params?.status || row.status === params.status) &&
        (!userId || row.requesterId === userId || row.acceptorId === userId),
    )
    .map((row) => ({ ...row }));
}

export function mockUpdateP2PRequestStatus(
  requestId: string,
  status: P2PAdminStatus,
): P2PRequestSummary {
  const index = requests.findIndex((row) => row.id === requestId);
  if (index < 0) {
    throw new ApiClientError(404, 'RESOURCE_NOT_FOUND', 'P2P request not found');
  }
  requests[index] = { ...requests[index]!, status };
  return { ...requests[index]! };
}

export function mockUpdateP2POrderStatus(
  orderId: string,
  status: P2PAdminStatus,
): P2POrderSummary {
  const index = orders.findIndex((row) => row.id === orderId);
  if (index < 0) {
    throw new ApiClientError(404, 'RESOURCE_NOT_FOUND', 'P2P order not found');
  }
  orders[index] = { ...orders[index]!, status };
  return { ...orders[index]! };
}
