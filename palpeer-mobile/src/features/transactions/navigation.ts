import { router } from 'expo-router';

import type { TransactionItemResponse } from '@/types/api/transaction';

/** The detail route needs the type because the backend lookup is `/transactions/{type}/{id}`. */
export function openTransaction(item: Pick<TransactionItemResponse, 'type' | 'id'>) {
  router.push({ pathname: '/transaction/[type]/[id]', params: { type: item.type, id: item.id } });
}
