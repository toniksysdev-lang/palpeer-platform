import type { AppError } from '@/services/api/errors';
import type {
  CardResponse,
  CardStatus,
  CardTransactionResponse,
  CardTransactionStatus,
  CardTransactionType,
} from '@/types/api/card';

/** Backend limit on `cardholderName`. */
export const CARDHOLDER_NAME_MAX = 120;

/** The number is only ever shown as its last four digits (R-CD-1). */
export function maskedNumber(lastFour: string): string {
  const digits = lastFour.replace(/\D/g, '').slice(-4);
  return `•••• ${digits || '••••'}`;
}

export function expiryLabel(card: Pick<CardResponse, 'expiryMonth' | 'expiryYear'>): string {
  if (!card.expiryMonth || !card.expiryYear) return '--/--';
  const month = String(card.expiryMonth).padStart(2, '0');
  const year = String(card.expiryYear % 100).padStart(2, '0');
  return `${month}/${year}`;
}

/** `STUB` is the placeholder issuer: its cards aren't real payment cards (R-CD-4). */
export function isTestCard(card: Pick<CardResponse, 'providerName'>): boolean {
  return card.providerName.toUpperCase() === 'STUB';
}

const STATUS_LABELS: Record<CardStatus, string> = {
  PENDING: 'Pending',
  ACTIVE: 'Active',
  BLOCKED: 'Frozen',
  CLOSED: 'Closed',
};

export function cardStatusLabel(status: CardStatus): string {
  return STATUS_LABELS[status] ?? status;
}

export function cardStatusTone(status: CardStatus): 'success' | 'warning' | 'neutral' | 'danger' {
  switch (status) {
    case 'ACTIVE':
      return 'success';
    case 'BLOCKED':
      return 'warning';
    case 'CLOSED':
      return 'danger';
    default:
      return 'neutral';
  }
}

export function canFreeze(card: Pick<CardResponse, 'status'>): boolean {
  return card.status === 'ACTIVE';
}

export function canUnfreeze(card: Pick<CardResponse, 'status'>): boolean {
  return card.status === 'BLOCKED';
}

export function cardTitle(card: Pick<CardResponse, 'brand' | 'currencyCode'>): string {
  return `${card.brand} ${card.currencyCode} card`;
}

const TRANSACTION_TYPE_LABELS: Record<CardTransactionType, string> = {
  AUTHORIZATION: 'Authorization',
  CAPTURE: 'Payment',
  REFUND: 'Refund',
  REVERSAL: 'Reversal',
  FEE: 'Fee',
  OTHER: 'Other',
};

export function cardTransactionTypeLabel(type: CardTransactionType): string {
  return TRANSACTION_TYPE_LABELS[type] ?? type;
}

const TRANSACTION_STATUS_LABELS: Record<CardTransactionStatus, string> = {
  PENDING: 'Pending',
  SETTLED: 'Settled',
  FAILED: 'Failed',
  REVERSED: 'Reversed',
};

export function cardTransactionStatusLabel(status: CardTransactionStatus): string {
  return TRANSACTION_STATUS_LABELS[status] ?? status;
}

/** Money coming back to the card: shown as a credit. Everything else is a debit. */
export function isCardCredit(transaction: Pick<CardTransactionResponse, 'entryType'>): boolean {
  return transaction.entryType === 'REFUND' || transaction.entryType === 'REVERSAL';
}

/** VERIFIED codes and 404 messages from CardService. */
const MESSAGES: Record<string, string> = {
  CARD_CLOSED: 'This card is closed and can no longer be changed.',
  CARD_NOT_BLOCKED: "This card isn't frozen.",
  CARD_WALLET_CURRENCY_MISMATCH: 'The linked wallet must be in the same currency as the card.',
};

export function cardErrorMessage(error: AppError): string {
  const known = error.code ? MESSAGES[error.code] : undefined;
  if (known) return known;
  if (error.status === 404) {
    if (/wallet/i.test(error.message)) return "That wallet wasn't found. Pick another one.";
    if (/currency/i.test(error.message)) return "That currency isn't available.";
    return "This card wasn't found.";
  }
  return error.message;
}
