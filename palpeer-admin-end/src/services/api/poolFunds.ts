import { apiRequest } from '@/services/api/client';
import type { PoolFundsBalances } from '@/types/poolFunds';

export async function getPoolFundsBalances(): Promise<PoolFundsBalances> {
  return apiRequest<PoolFundsBalances>('/admin/pool-funds');
}
