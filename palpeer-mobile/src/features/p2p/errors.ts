import type { AppError } from '@/services/api/errors';

export const NOT_OPEN_MESSAGE = 'This request is no longer open.';

/** VERIFIED codes from `P2PService` and `CurrencyService`. */
const MESSAGES: Record<string, string> = {
  P2P_NOT_OPEN: NOT_OPEN_MESSAGE,
  P2P_SELF_ACCEPT: "You can't accept your own request.",
  P2P_SAME_CURRENCY: 'Choose two different currencies.',
  P2P_EXPIRES_INVALID: 'The expiry time has already passed. Choose a later time.',
  P2P_WALLET_REQUIRED: 'Create a wallet for that currency before posting a sell request.',
  INSUFFICIENT_AVAILABLE_BALANCE: "You don't have enough available balance for this sell request.",
};

export function p2pErrorMessage(error: AppError): string {
  return (error.code && MESSAGES[error.code]) || error.message;
}

/** A 404 on request actions means it doesn't exist (or isn't the caller's, for edit/cancel). */
export function requestActionErrorMessage(error: AppError): string {
  if (error.status === 404) return "We couldn't find this request.";
  return p2pErrorMessage(error);
}

/** The request left OPEN meanwhile (accepted, cancelled or expired); refresh its status. */
export function isNotOpen(error: AppError): boolean {
  return error.code === 'P2P_NOT_OPEN';
}
