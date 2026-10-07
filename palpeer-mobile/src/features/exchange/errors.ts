import type { AppError } from '@/services/api/errors';

/** APK evidence copy, used when the backend has no rate for the pair (404 on calculate/preview). */
export const NO_RATE_MESSAGE = 'Cannot currently swap between these currencies.';

/** APK evidence copy for fewer than two wallets in different currencies. */
export const NEED_TWO_WALLETS_MESSAGE =
  'You need at least two different currency wallets to perform a swap.';

/** VERIFIED codes from `ExchangeQuoteService`, `ExchangeExecutionService` and the ledger. */
const MESSAGES: Record<string, string> = {
  EXCHANGE_AMOUNT_INVALID: 'This amount is too small to exchange. Enter a larger amount.',
  EXCHANGE_AMOUNT_REQUIRED: 'Enter an amount to exchange.',
  EXCHANGE_SAME_WALLET: 'Choose two wallets in different currencies.',
  EXCHANGE_SAME_CURRENCY: 'Choose two wallets in different currencies.',
  EXCHANGE_QUOTE_EXPIRED: 'This quote has expired. Get a new quote to continue.',
  EXCHANGE_QUOTE_NOT_OPEN: "This quote can't be used any more. Get a new quote to continue.",
  EXCHANGE_IDEMPOTENCY_CONFLICT:
    'This exchange was already sent with different details. Get a new quote to continue.',
  INSUFFICIENT_AVAILABLE_BALANCE: "You don't have enough available balance for this exchange.",
};

/**
 * Calculate/preview only use wallets from the user's own list, so a 404 there means the pair has no
 * published rate (`"No exchange rate for X/Y"`).
 */
export function quoteErrorMessage(error: AppError): string {
  if (error.status === 404) return NO_RATE_MESSAGE;
  return (error.code && MESSAGES[error.code]) || error.message;
}

/** On execute a 404 means the quote no longer exists for this user. */
export function executeErrorMessage(error: AppError): string {
  if (error.status === 404) return MESSAGES.EXCHANGE_QUOTE_NOT_OPEN ?? error.message;
  return (error.code && MESSAGES[error.code]) || error.message;
}

/** The quote can't be executed any more; the user needs a fresh one. */
export function needsNewQuote(error: AppError): boolean {
  return (
    error.status === 404 ||
    error.code === 'EXCHANGE_QUOTE_EXPIRED' ||
    error.code === 'EXCHANGE_QUOTE_NOT_OPEN' ||
    error.code === 'EXCHANGE_IDEMPOTENCY_CONFLICT'
  );
}
