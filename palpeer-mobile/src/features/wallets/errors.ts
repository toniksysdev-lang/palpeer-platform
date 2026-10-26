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
  INTERNAL_PAYMENT_ERROR: 'Internal Payment Error, please contact support',
  IDENTITY_VERIFICATION_REQUIRED:
    'Identity verification is required to withdraw this amount. Complete KYC and try again.',
  APAYLO_DESTINATION_INVALID: 'Check the bank details: institution, transit and account number.',
  KUDA_DESTINATION_REQUIRED: 'Enter the bank code and account number.',
  KUDA_DESTINATION_INVALID: 'Check the bank code and account number.',
  KUDA_NAME_ENQUIRY_FAILED:
    "We couldn't confirm that bank account. Check the details and try again.",
  APAYLO_ERROR: "The payment provider couldn't process this. Try again later.",
  KORAPAY_ERROR: "The payment provider couldn't process this. Try again later.",
  KORAPAY_AMOUNT_TOO_LOW: 'Enter at least ₦100 to fund with bank transfer.',
  KORAPAY_WITHDRAWAL_UNSUPPORTED: 'NGN withdrawals aren’t available with this payment method yet.',
  KUDA_ERROR: "The payment provider couldn't process this. Try again later.",
  KUDA_AUTH_FAILED: "The payment provider couldn't process this. Try again later.",
  KUDA_DISABLED: 'NGN payments are temporarily unavailable. Try again later.',
  KUDA_CLIENT_ACCOUNT_REQUIRED: 'NGN withdrawals are temporarily unavailable. Try again later.',
  KUDA_PERMISSION_DENIED:
    "Naira funding isn't enabled for this payment account yet. Contact support.",
};

const GENERIC_SERVER_FALLBACK = 'Something went wrong on our side. Please try again.';

export function walletErrorMessage(error: AppError): string {
  if (
    error.code === 'KUDA_ERROR' &&
    /do not have permission|contact the api team/i.test(error.message ?? '')
  ) {
    return MESSAGES.KUDA_PERMISSION_DENIED;
  }
  const mapped = error.code ? MESSAGES[error.code] : undefined;
  // Prefer a specific Kuda/Korapay message when the API returned one (e.g. invalid phone).
  // Skip the generic 5xx fallback — that is not a provider message.
  if (
    (error.code === 'KUDA_ERROR' || error.code === 'KORAPAY_ERROR') &&
    error.message &&
    error.message !== GENERIC_SERVER_FALLBACK &&
    error.message.length > 0 &&
    error.message.length <= 160 &&
    !/^Kuda request failed/i.test(error.message) &&
    !/^Korapay request failed/i.test(error.message)
  ) {
    return error.message;
  }
  return mapped || error.message;
}

export function isIdempotencyConflict(error: AppError): boolean {
  return (
    error.code === 'FUNDING_IDEMPOTENCY_CONFLICT' ||
    error.code === 'WITHDRAWAL_IDEMPOTENCY_CONFLICT' ||
    error.code === 'TRANSFER_IDEMPOTENCY_CONFLICT'
  );
}
