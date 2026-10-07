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
  fundingInstructions: 'Pay via Interac e-Transfer Request Money. Reference=APY-1',
  createdAt: '2026-09-28T10:00:00Z',
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
