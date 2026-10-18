export const USER_STATUSES = [
  'PENDING_VERIFICATION',
  'ACTIVE',
  'SUSPENDED',
  'CLOSED',
] as const;

export type UserStatus = (typeof USER_STATUSES)[number];

export type UpdateUserAdminInput = {
  status?: UserStatus | null;
  enabled?: boolean | null;
};

export const TRANSACTION_ACTIVITY_TYPES = ['FUNDING', 'WITHDRAWAL', 'EXCHANGE', 'TRANSFER'] as const;
export type TransactionActivityType = (typeof TRANSACTION_ACTIVITY_TYPES)[number];

export const TRANSACTION_STATUSES = [
  'INITIATED',
  'PENDING',
  'PROCESSING',
  'SUCCESS',
  'FAILED',
  'REVERSED',
] as const;

export type TransactionItem = {
  type: TransactionActivityType | string;
  id: string;
  userId?: string | null;
  userEmail?: string | null;
  status: string;
  walletId?: string | null;
  secondaryWalletId?: string | null;
  currencyCode?: string | null;
  secondaryCurrencyCode?: string | null;
  amount?: number | string | null;
  secondaryAmount?: number | string | null;
  appliedRate?: number | string | null;
  failureReason?: string | null;
  ledgerEntryIds?: Record<string, string> | null;
  createdAt: string;
  updatedAt?: string | null;
};

export type TransactionPage = {
  items: TransactionItem[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};
