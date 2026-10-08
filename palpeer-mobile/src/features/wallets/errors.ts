import type { AppError } from '@/services/api/errors';

/** VERIFIED codes from WalletService, FundingService, WithdrawalService and the payment rails. */
const MESSAGES: Record<string, string> = {
  WALLET_EXISTS: 'You already have a wallet in this currency.',
  INSUFFICIENT_AVAILABLE_BALANCE: "You don't have enough available balance for this withdrawal.",
  INSUFFICIENT_FUNDS: "You don't have enough available balance for this transfer.",
  TRANSFER_TO_SELF: 'You cannot transfer to yourself.',
  RECIPIENT_NOT_FOUND: 'No Palpeer user was found for that email or phone number.',
  RECIPIENT_WALLET_MISSING: "That user doesn't have a wallet in this currency yet.",
  TRANSFER_IDEMPOTENCY_CONFLICT:
    'This request was already sent with different details. Start again.',
  FUNDING_IDEMPOTENCY_CONFLICT:
    'This request was already sent with different details. Start again.',
  WITHDRAWAL_IDEMPOTENCY_CONFLICT:
    'This request was already sent with different details. Start again.',
  PAYMENT_RAIL_UNAVAILABLE: "This payment method isn't available right now. Try again later.",
  APAYLO_DESTINATION_INVALID: 'Check the bank details: institution, transit and account number.',
  KUDA_DESTINATION_REQUIRED: 'Enter the bank code and account number.',
  KUDA_DESTINATION_INVALID: 'Check the bank code and account number.',
  KUDA_NAME_ENQUIRY_FAILED:
    "We couldn't confirm that bank account. Check the details and try again.",
  APAYLO_ERROR: "The payment provider couldn't process this. Try again later.",
  KUDA_ERROR: "The payment provider couldn't process this. Try again later.",
  KUDA_AUTH_FAILED: "The payment provider couldn't process this. Try again later.",
};

export function walletErrorMessage(error: AppError): string {
  return (error.code && MESSAGES[error.code]) || error.message;
}

export function isIdempotencyConflict(error: AppError): boolean {
  return (
    error.code === 'FUNDING_IDEMPOTENCY_CONFLICT' ||
    error.code === 'WITHDRAWAL_IDEMPOTENCY_CONFLICT' ||
    error.code === 'TRANSFER_IDEMPOTENCY_CONFLICT'
  );
}
