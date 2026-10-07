export type CountsByKey = Record<string, number>;

export type WalletCurrencyBalance = {
  currencyCode: string;
  walletCount: number;
  availableTotal: string | number;
  pendingTotal: string | number;
};

export type TransactionSuccessVolume = {
  type: string;
  currencyCode: string;
  count: number;
  amount: string | number;
};

export type BonusAmountByStatusAndCurrency = {
  status: string;
  currencyCode: string;
  amount: string | number;
};

export type AdminReportsSummary = {
  generatedAt: string;
  from: string;
  to: string;
  users: { total: number; byStatus: CountsByKey };
  kyc: { total: number; byStatus: CountsByKey };
  wallets: { total: number; balancesByCurrency: WalletCurrencyBalance[] };
  transactions: {
    countsByType: CountsByKey;
    countsByTypeAndStatus: CountsByKey;
    successVolume: TransactionSuccessVolume[];
  };
  p2p: { requestsByStatus: CountsByKey; ordersByStatus: CountsByKey };
  cards: { byStatus: CountsByKey };
  referrals: { byStatus: CountsByKey };
  bonuses: { byStatus: CountsByKey; amountByStatusAndCurrency: BonusAmountByStatusAndCurrency[] };
};

export const REPORT_DATASETS = [
  'users',
  'kyc-cases',
  'wallets',
  'transactions',
  'p2p-requests',
  'p2p-orders',
  'audit-logs',
] as const;

export type ReportDataset = (typeof REPORT_DATASETS)[number];

export type ReportWindow = {
  from?: string;
  to?: string;
};
