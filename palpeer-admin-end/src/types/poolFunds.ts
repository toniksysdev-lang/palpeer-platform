export type ProviderPoolBalance = {
  provider: string;
  currencyCode: string;
  configured: boolean;
  available: boolean;
  /** Booked pool: funding − withdrawals + InstantEX in − InstantEX out. */
  balance: string | number | null;
  pendingBalance?: string | number | null;
  /** Provider settlement adjusted by funding, withdrawals, and InstantEX. */
  liveBalance?: string | number | null;
  fundedTotal?: string | number | null;
  withdrawnTotal?: string | number | null;
  instantExReceivedTotal?: string | number | null;
  instantExPaidTotal?: string | number | null;
  message: string | null;
};

export type PoolFundsBalances = {
  apaylo: ProviderPoolBalance;
  korapay: ProviderPoolBalance;
  kuda: ProviderPoolBalance;
};
