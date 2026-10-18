import { apiRequest } from '@/services/api/client';
import type {
  PinPolicy,
  PoolFundThreshold,
  UpdatePinPolicyInput,
  UpsertPoolFundThresholdInput,
  UpsertWithdrawalUnverifiedLimitInput,
  WithdrawalUnverifiedLimit,
} from '@/types/platformSettings';

export async function listPoolFundThresholds(): Promise<PoolFundThreshold[]> {
  return apiRequest<PoolFundThreshold[]>('/admin/settings/pool-fund-thresholds');
}

export async function upsertPoolFundThreshold(
  input: UpsertPoolFundThresholdInput,
): Promise<PoolFundThreshold> {
  return apiRequest<PoolFundThreshold>('/admin/settings/pool-fund-thresholds', {
    method: 'PUT',
    body: input,
  });
}

export async function getPinPolicy(): Promise<PinPolicy> {
  return apiRequest<PinPolicy>('/admin/settings/pin-policy');
}

export async function updatePinPolicy(input: UpdatePinPolicyInput): Promise<PinPolicy> {
  return apiRequest<PinPolicy>('/admin/settings/pin-policy', {
    method: 'PUT',
    body: input,
  });
}

export async function listWithdrawalUnverifiedLimits(): Promise<WithdrawalUnverifiedLimit[]> {
  return apiRequest<WithdrawalUnverifiedLimit[]>('/admin/settings/withdrawal-unverified-limits');
}

export async function upsertWithdrawalUnverifiedLimit(
  input: UpsertWithdrawalUnverifiedLimitInput,
): Promise<WithdrawalUnverifiedLimit> {
  return apiRequest<WithdrawalUnverifiedLimit>('/admin/settings/withdrawal-unverified-limits', {
    method: 'PUT',
    body: input,
  });
}
