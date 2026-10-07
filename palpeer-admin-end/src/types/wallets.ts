export type WalletSummary = {
  id: string;
  userId: string;
  currencyCode: string;
  /** Backend-authoritative. Never recalculate on the client. */
  availableBalance: string | number;
  pendingBalance: string | number;
};

export type LedgerTransactionSummary = {
  id: string;
  walletId: string;
  entryType: string;
  amount: string | number;
  currencyCode: string;
  availableBalanceAfter?: string | number | null;
  pendingBalanceAfter?: string | number | null;
  referenceType?: string | null;
  referenceId?: string | null;
  description?: string | null;
  createdAt: string;
};
