/** Shaped like the backend `CardResponse`, including the issuer id the app must drop. */
export const card = (overrides: Record<string, unknown> = {}) => ({
  id: 'card-1',
  walletId: null,
  providerName: 'STUB',
  providerCardId: 'stub_secret_provider_ref',
  lastFour: '4242',
  brand: 'VISA',
  currencyCode: 'CAD',
  status: 'ACTIVE',
  expiryMonth: 12,
  expiryYear: 2030,
  cardholderName: 'Ada Lovelace',
  createdAt: '2026-09-29T10:00:00Z',
  ...overrides,
});

export const cardTransaction = (overrides: Record<string, unknown> = {}) => ({
  id: 'ct-1',
  cardId: 'card-1',
  providerTransactionId: 'stub_tx_ref',
  entryType: 'CAPTURE',
  status: 'SETTLED',
  amount: '12.50',
  currencyCode: 'CAD',
  merchantName: 'Coffee Shop',
  occurredAt: '2026-09-29T11:00:00Z',
  ledgerEntryId: null,
  failureReason: null,
  createdAt: '2026-09-29T11:00:00Z',
  ...overrides,
});

export const cardPage = (
  content: unknown[],
  { number = 0, last = true }: { number?: number; last?: boolean } = {},
) => ({
  content,
  totalElements: content.length,
  totalPages: last ? number + 1 : number + 2,
  number,
  size: 20,
  first: number === 0,
  last,
  empty: content.length === 0,
});
