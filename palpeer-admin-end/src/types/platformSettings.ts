export type PoolFundThreshold = {
  id: string | null;
  provider: string;
  currencyCode: string;
  thresholdAmount: string | number | null;
  currentBalance: string | number | null;
  thresholdHit: boolean;
  notifyAdminUserIds: string[];
  notifyPhones: string[];
  updatedAt: string | null;
};

export type UpsertPoolFundThresholdInput = {
  provider: string;
  currencyCode: string;
  thresholdAmount: number;
  notifyAdminUserIds: string[];
  notifyPhones: string[];
};

export type PinPolicy = {
  maxWrongAttempts: number;
  lockoutHours: string | number;
  updatedAt: string | null;
};

export type UpdatePinPolicyInput = {
  maxWrongAttempts: number;
  lockoutHours: number;
};

export type WithdrawalUnverifiedLimit = {
  id: string | null;
  currencyCode: string;
  maxAmount: string | number | null;
  updatedAt: string | null;
};

export type UpsertWithdrawalUnverifiedLimitInput = {
  currencyCode: string;
  maxAmount: number;
};

export type FundingUnverifiedLimit = {
  id: string | null;
  currencyCode: string;
  maxAmount: string | number | null;
  updatedAt: string | null;
};

export type UpsertFundingUnverifiedLimitInput = {
  currencyCode: string;
  maxAmount: number;
};
