import type { Money } from '@/utils/money';

import type { IsoInstant, Uuid } from './common';

/** VERIFIED: `CurrencyResponse`. `precision` = decimal places used for display. */
export type CurrencyResponse = {
  id: Uuid;
  code: string;
  symbol: string;
  precision: number;
};

/** VERIFIED: `WalletResponse`. One wallet per currency; no status field exists. */
export type WalletResponse = {
  id: Uuid;
  userId: Uuid;
  currencyCode: string;
  availableBalance: Money;
  pendingBalance: Money;
  /** Present on admin inventory responses only. */
  userEmail?: string | null;
  userFirstName?: string | null;
  userLastName?: string | null;
};

/** VERIFIED: `CreateWalletRequest` — code 3–10 chars, must exist in `GET /currencies`. */
export type CreateWalletRequest = { currencyCode: string };

/** VERIFIED: `LedgerEntryType`. */
export type LedgerEntryType = 'CREDIT' | 'DEBIT' | 'HOLD' | 'RELEASE';

/** VERIFIED: `LedgerTransactionResponse` (wallet transactions, newest first). */
export type LedgerTransactionResponse = {
  id: Uuid;
  walletId: Uuid;
  entryType: LedgerEntryType;
  amount: Money;
  currencyCode: string;
  availableBalanceAfter: Money;
  pendingBalanceAfter: Money;
  /** `FUNDING`, `FUNDING_REVERSAL`, `WITHDRAWAL`, `WITHDRAWAL_REVERSAL`, `EXCHANGE` (free text). */
  referenceType: string | null;
  referenceId: string | null;
  description: string | null;
  createdAt: IsoInstant;
};

/** VERIFIED: `MoneyMovementStatus` (funding and withdrawal). */
export type MoneyMovementStatus =
  'INITIATED' | 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED' | 'REVERSED';

/** VERIFIED: `CreateFundingRequest`. `amount` > 0; sent as an exact JSON number. */
export type CreateFundingRequest = { walletId: Uuid; amount: Money };

/** VERIFIED: `FundingTransactionResponse`. */
export type FundingTransactionResponse = {
  id: Uuid;
  walletId: Uuid;
  amount: Money;
  currencyCode: string;
  status: MoneyMovementStatus;
  idempotencyKey: string;
  ledgerEntryId: Uuid | null;
  reversalLedgerEntryId: Uuid | null;
  failureReason: string | null;
  /** `APAYLO` or `KUDA` when a payment rail handled the request. */
  providerName: string | null;
  providerReference: string | null;
  /** Plain text from the provider, shown verbatim. */
  fundingInstructions: string | null;
  createdAt: IsoInstant;
};

/** VERIFIED: `BankOptionResponse` — payout banks (NGN withdrawals). */
export type BankOptionResponse = {
  code: string;
  name: string;
  slug: string | null;
};

/** VERIFIED: `CreateWithdrawalRequest`. */
export type CreateWithdrawalRequest = {
  walletId: Uuid;
  amount: Money;
  destinationReference?: string;
};

/** VERIFIED: `WithdrawalTransactionResponse`. */
export type WithdrawalTransactionResponse = {
  id: Uuid;
  walletId: Uuid;
  amount: Money;
  currencyCode: string;
  status: MoneyMovementStatus;
  idempotencyKey: string;
  holdLedgerEntryId: Uuid | null;
  debitLedgerEntryId: Uuid | null;
  releaseLedgerEntryId: Uuid | null;
  reversalLedgerEntryId: Uuid | null;
  failureReason: string | null;
  destinationReference: string | null;
  providerName: string | null;
  providerReference: string | null;
  createdAt: IsoInstant;
};

/** VERIFIED: wallet-to-wallet transfer between users (same currency). */
export type CreateWalletTransferRequest = {
  sourceWalletId: Uuid;
  /** Recipient email or E.164 phone. */
  recipient: string;
  amount: Money;
  note?: string;
};

/** VERIFIED: `TransferRecipientResponse` from GET /transfers/recipient?q=. */
export type TransferRecipientResponse = {
  userId: Uuid;
  displayName: string;
  recipient: string;
  matchedBy: 'EMAIL' | 'PHONE' | string;
  /** Present when currencyCode was sent on the lookup. */
  hasWallet: boolean | null;
};

export type WalletTransferResponse = {
  id: Uuid;
  senderUserId: Uuid;
  recipientUserId: Uuid;
  sourceWalletId: Uuid;
  destinationWalletId: Uuid;
  currencyCode: string;
  amount: Money;
  note: string | null;
  createdAt: IsoInstant;
};

/** VERIFIED: `TransactionActivityType` (unified feed). */
export type TransactionActivityType = 'FUNDING' | 'WITHDRAWAL' | 'EXCHANGE' | 'TRANSFER' | 'P2P';

/** VERIFIED: `TransactionItemResponse` (unified feed over funding, withdrawal, exchange, transfer, P2P). */
export type TransactionItemResponse = {
  type: TransactionActivityType;
  id: Uuid;
  userId: Uuid;
  status: string;
  walletId: Uuid | null;
  secondaryWalletId: Uuid | null;
  currencyCode: string;
  secondaryCurrencyCode: string | null;
  amount: Money;
  secondaryAmount: Money | null;
  appliedRate: Money | null;
  failureReason: string | null;
  ledgerEntryIds: Record<string, Uuid>;
  createdAt: IsoInstant;
  updatedAt: IsoInstant;
};
