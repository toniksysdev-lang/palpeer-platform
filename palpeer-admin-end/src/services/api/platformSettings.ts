import { apiRequest } from '@/services/api/client';
import type {
  FundingUnverifiedLimit,
  PinPolicy,
  PoolFundThreshold,
  UpdatePinPolicyInput,
  UpsertFundingUnverifiedLimitInput,
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

export async function listFundingUnverifiedLimits(): Promise<FundingUnverifiedLimit[]> {
  return apiRequest<FundingUnverifiedLimit[]>('/admin/settings/funding-unverified-limits');
}

export async function upsertFundingUnverifiedLimit(
  input: UpsertFundingUnverifiedLimitInput,
): Promise<FundingUnverifiedLimit> {
  return apiRequest<FundingUnverifiedLimit>('/admin/settings/funding-unverified-limits', {
    method: 'PUT',
    body: input,
  });
}

export type RegistrationCountries = {
  /** @deprecated Prefer configuredIso2 */
  supportedIso2?: string[];
  configuredIso2: string[];
  enabledIso2: string[];
};

export type UpdateRegistrationCountriesInput = {
  configuredIso2: string[];
  enabledIso2: string[];
};

export async function getRegistrationCountries(): Promise<RegistrationCountries> {
  return apiRequest<RegistrationCountries>('/admin/settings/registration-countries');
}

export async function updateRegistrationCountries(
  input: UpdateRegistrationCountriesInput,
): Promise<RegistrationCountries> {
  return apiRequest<RegistrationCountries>('/admin/settings/registration-countries', {
    method: 'PUT',
    body: input,
  });
}
