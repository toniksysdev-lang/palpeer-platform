import { ok } from '@/tests/fetchMock';

export const CURRENCIES = ok([
  { id: 'c-cad', code: 'CAD', symbol: 'C$', precision: 2 },
  { id: 'c-ngn', code: 'NGN', symbol: 'N', precision: 2 },
  { id: 'c-usd', code: 'USD', symbol: '$', precision: 2 },
]);

export const wallet = (
  id: string,
  currencyCode: string,
  availableBalance = '0.000000000000',
  pendingBalance = '0.000000000000',
) => ({ id, userId: 'u-1', currencyCode, availableBalance, pendingBalance });

/** A raw envelope so money fields reach the client as JSON numbers with full digits. */
export function rawOk(json: string) {
  return { status: 200, rawBody: `{"success":true,"data":${json},"timestamp":""}` };
}

export const ledgerPage = (
  content: unknown[],
  { number = 0, last = true }: { number?: number; last?: boolean } = {},
) =>
  ok({
    content,
    number,
    size: 20,
    first: number === 0,
    last,
    empty: content.length === 0,
    totalElements: content.length,
    totalPages: 1,
  });

export const ledgerEntry = (
  id: string,
  entryType: string,
  amount: string,
  availableBalanceAfter: string,
  description: string,
) => ({
  id,
  walletId: 'w-cad',
  entryType,
  amount,
  currencyCode: 'CAD',
  availableBalanceAfter,
  pendingBalanceAfter: '0',
  referenceType: 'FUNDING',
  referenceId: 'f-1',
  description,
  createdAt: '2026-09-28T10:00:00Z',
});

export const funding = (overrides: Record<string, unknown> = {}) => ({
  id: 'f-1',
  walletId: 'w-cad',
  amount: '250.00',
  currencyCode: 'CAD',
  status: 'PENDING',
  idempotencyKey: 'k',
  ledgerEntryId: null,
  reversalLedgerEntryId: null,
  failureReason: null,
  providerName: 'APAYLO',
  providerReference: 'APY-1',
  fundingInstructions:
    'Instant deposit via Interac. Send CAD 250.00 with Interac e-Transfer to "Palpeer Global Holding Inc". Reference=APY-1. Open your banking app → Send → Interac → search for "Palpeer Global Holding Inc". You initiate the transfer — we do not send an Interac request to your email. Your Interac email: sesanelect@yahoo.com.',
  paymentDetails: {
    accountNumber: null,
    accountName: 'Palpeer Global Holding Inc',
    bankName: 'Interac',
    bankCode: null,
    trackingReference: 'APY-1',
    amount: '250.00',
    currencyCode: 'CAD',
    method: 'INTERAC_INSTANT',
    interacEmail: 'sesanelect@yahoo.com',
    aplReference: null,
  },
  createdAt: '2026-09-28T10:00:00Z',
  ...overrides,
});

export const ngnFunding = (overrides: Record<string, unknown> = {}) =>
  funding({
    id: 'f-ngn-1',
    walletId: 'w-ngn',
    amount: '5000.00',
    currencyCode: 'NGN',
    providerName: 'KUDA',
    providerReference: 'f-ngn-1',
    fundingInstructions:
      'Transfer NGN 5000.00 to Kuda virtual account 3001234567 (PALPEER USER); bank=Kuda; tracking=pptrackingref001; ref=f-ngn-1. Your balance updates once Kuda confirms the credit.',
    paymentDetails: {
      accountNumber: '3001234567',
      accountName: 'PALPEER USER',
      bankName: 'Kuda',
      bankCode: '090267',
      trackingReference: 'pptrackingref001',
      amount: '5000.00',
      currencyCode: 'NGN',
      method: 'BANK_TRANSFER',
      interacEmail: null,
      aplReference: null,
    },
    ...overrides,
  });

export const withdrawal = (overrides: Record<string, unknown> = {}) => ({
  id: 'wd-1',
  walletId: 'w-cad',
  amount: '100.00',
  currencyCode: 'CAD',
  status: 'PENDING',
  idempotencyKey: 'k',
  holdLedgerEntryId: 'l-1',
  debitLedgerEntryId: null,
  releaseLedgerEntryId: null,
  reversalLedgerEntryId: null,
  failureReason: null,
  destinationReference: '001:12345:9876543',
  providerName: null,
  providerReference: null,
  createdAt: '2026-09-28T10:00:00Z',
  ...overrides,
});
