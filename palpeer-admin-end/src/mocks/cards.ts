import type { SpringPage } from '@/types/admin';
import { ApiClientError } from '@/types/api';
import type { CardSummary, CardTransactionSummary } from '@/types/cards';

const now = Date.now();

const cards: CardSummary[] = [
  {
    id: 'card-1',
    userId: 'u-2',
    walletId: 'w-1',
    providerName: 'mock-provider',
    providerCardId: 'prov-1',
    lastFour: '4242',
    brand: 'VISA',
    currencyCode: 'CAD',
    status: 'ACTIVE',
    expiryMonth: 12,
    expiryYear: 2028,
    cardholderName: 'Mock Cardholder',
    createdAt: new Date(now - 86400000 * 10).toISOString(),
  },
  {
    id: 'card-2',
    userId: 'u-3',
    walletId: 'w-3',
    providerName: 'mock-provider',
    providerCardId: 'prov-2',
    lastFour: '1111',
    brand: 'MASTERCARD',
    currencyCode: 'CAD',
    status: 'BLOCKED',
    expiryMonth: 6,
    expiryYear: 2027,
    cardholderName: 'Another Holder',
    createdAt: new Date(now - 86400000 * 40).toISOString(),
  },
];

const transactions: Record<string, CardTransactionSummary[]> = {
  'card-1': [
    {
      id: 'ctx-1',
      cardId: 'card-1',
      providerTransactionId: 'ptx-1',
      entryType: 'PURCHASE',
      status: 'COMPLETED',
      amount: '24.50',
      currencyCode: 'CAD',
      merchantName: 'Mock Merchant',
      occurredAt: new Date(now - 3600000).toISOString(),
      createdAt: new Date(now - 3600000).toISOString(),
    },
  ],
  'card-2': [],
};

function toPage<T>(rows: T[], page: number, size: number): SpringPage<T> {
  const start = page * size;
  const content = rows.slice(start, start + size);
  const totalElements = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalElements / size) || 1);
  return {
    content,
    totalElements,
    totalPages,
    size,
    number: page,
    numberOfElements: content.length,
    first: page === 0,
    last: page >= totalPages - 1,
    empty: content.length === 0,
  };
}

export function mockListCards(params?: {
  page?: number;
  size?: number;
  userId?: string;
  status?: string;
}): SpringPage<CardSummary> {
  return toPage(
    cards
      .filter(
        (card) =>
          (!params?.userId || card.userId === params.userId) &&
          (!params?.status || card.status === params.status),
      )
      .map((card) => ({ ...card })),
    params?.page ?? 0,
    params?.size ?? 20,
  );
}

export function mockGetCard(cardId: string): CardSummary {
  const found = cards.find((card) => card.id === cardId);
  if (!found) {
    throw new ApiClientError(404, 'RESOURCE_NOT_FOUND', 'Card not found');
  }
  return { ...found };
}

export function mockCardTransactions(
  cardId: string,
  params?: { page?: number; size?: number },
): SpringPage<CardTransactionSummary> {
  const rows = (transactions[cardId] ?? []).map((row) => ({ ...row }));
  return toPage(rows, params?.page ?? 0, params?.size ?? 20);
}

export function mockBlockCard(cardId: string): CardSummary {
  const index = cards.findIndex((card) => card.id === cardId);
  if (index < 0) {
    throw new ApiClientError(404, 'RESOURCE_NOT_FOUND', 'Card not found');
  }
  const next = { ...cards[index]!, status: 'BLOCKED' };
  cards[index] = next;
  return { ...next };
}

export function mockUnblockCard(cardId: string): CardSummary {
  const index = cards.findIndex((card) => card.id === cardId);
  if (index < 0) {
    throw new ApiClientError(404, 'RESOURCE_NOT_FOUND', 'Card not found');
  }
  const next = { ...cards[index]!, status: 'ACTIVE' };
  cards[index] = next;
  return { ...next };
}

/** Mask helper — never invent full PAN. */
export function formatMaskedPan(lastFour: string): string {
  const digits = lastFour.replace(/\D/g, '').slice(-4);
  return `•••• •••• •••• ${digits.padStart(4, '•')}`;
}
