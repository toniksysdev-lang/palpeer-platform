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
