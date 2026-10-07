import type { TransactionItem } from '@/types/users';

export function transactionDetailPath(
  row: Pick<TransactionItem, 'id' | 'type' | 'userId'>,
  fallbackUserId?: string,
): string {
  const search = new URLSearchParams({ type: row.type });
  const userId = row.userId ?? fallbackUserId;
  if (userId) search.set('userId', userId);
  return `/admin/transactions/${encodeURIComponent(row.id)}?${search.toString()}`;
}
