export type CardSummary = {
  id: string;
  userId?: string | null;
  walletId: string;
  providerName?: string | null;
  providerCardId?: string | null;
  /** Masked last four only — never full PAN. */
  lastFour: string;
  brand?: string | null;
  currencyCode: string;
  status: string;
  expiryMonth?: number | null;
  expiryYear?: number | null;
  cardholderName?: string | null;
  createdAt: string;
};

export type CardTransactionSummary = {
  id: string;
  cardId: string;
  providerTransactionId?: string | null;
  entryType: string;
  status: string;
  amount: string | number;
  currencyCode: string;
  merchantName?: string | null;
  occurredAt?: string | null;
  ledgerEntryId?: string | null;
  failureReason?: string | null;
  createdAt: string;
};
