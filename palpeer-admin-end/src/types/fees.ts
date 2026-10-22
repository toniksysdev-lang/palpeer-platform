export type P2PFeeType = 'FIXED' | 'PERCENTAGE';

export type P2PFeeTier = {
  id: string;
  baseCurrencyCode: string;
  quoteCurrencyCode: string;
  feeType: P2PFeeType;
  feeValue: string | number;
  minAmount: string | number;
  maxAmount: string | number | null;
  active: boolean;
};

export type UpsertP2PFeeTierInput = {
  baseCurrencyCode: string;
  quoteCurrencyCode: string;
  feeType: P2PFeeType;
  feeValue: string;
  minAmount: string;
  maxAmount?: string;
  active: boolean;
};

export type InstantExFeeTier = P2PFeeTier;
export type UpsertInstantExFeeTierInput = UpsertP2PFeeTierInput;

export type PlatformFeeSourceType = 'P2P' | 'INSTANT_EX';

export type PlatformFeeRevenue = {
  id: string;
  sourceType: PlatformFeeSourceType;
  referenceType: string;
  referenceId: string;
  userId: string;
  userEmail?: string | null;
  currencyCode: string;
  amount: string | number;
  description?: string | null;
  createdAt: string;
};

export type PlatformFeeCurrencyTotal = {
  currencyCode: string;
  amount: string | number;
  count: number;
};

export type PlatformFeeSummary = {
  grandTotal: PlatformFeeCurrencyTotal[];
  p2pTotal: PlatformFeeCurrencyTotal[];
  instantExTotal: PlatformFeeCurrencyTotal[];
};
