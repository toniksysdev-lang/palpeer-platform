export type RateChannel = 'SWAP' | 'P2P';
export type RateApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type ExchangeRate = {
  id: string;
  baseCurrencyCode: string;
  quoteCurrencyCode: string;
  buyRate: string | number;
  sellRate: string | number;
  effectiveDate: string;
  channel?: RateChannel;
  active?: boolean;
  approvalStatus?: RateApprovalStatus;
};

export type CreateCurrencyInput = {
  code: string;
  symbol: string;
  precision: number;
};

export type CreateExchangeRateInput = {
  baseCurrencyCode: string;
  quoteCurrencyCode: string;
  buyRate: string;
  sellRate: string;
  effectiveDate: string;
  channel?: RateChannel;
  submitForApproval?: boolean;
};

export type P2PRateBound = {
  id: string;
  baseCurrencyCode: string;
  quoteCurrencyCode: string;
  minRate: string | number;
  maxRate: string | number;
  updatedAt?: string;
};

export type UpsertP2PRateBoundInput = {
  baseCurrencyCode: string;
  quoteCurrencyCode: string;
  minRate: string;
  maxRate: string;
};
