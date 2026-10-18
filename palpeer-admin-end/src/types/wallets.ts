export type WalletSummary = {
  id: string;
  userId: string;
  currencyCode: string;
  /** Backend-authoritative. Never recalculate on the client. */
  availableBalance: string | number;
  pendingBalance: string | number;
  userEmail?: string | null;
  userFirstName?: string | null;
  userLastName?: string | null;
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

export type MoneyMovementStatus =
  | 'INITIATED'
  | 'PENDING'
  | 'PROCESSING'
  | 'SUCCESS'
  | 'FAILED'
  | 'REVERSED';

export type MoneyMovementType = 'FUNDING' | 'WITHDRAWAL';

export type AdminMoneyMovement = {
  id: string;
  type: MoneyMovementType;
  walletId: string;
  userId: string;
  amount: string | number;
  currencyCode: string;
  status: MoneyMovementStatus;
  failureReason?: string | null;
  reference?: string | null;
  providerName?: string | null;
  createdAt: string;
};
