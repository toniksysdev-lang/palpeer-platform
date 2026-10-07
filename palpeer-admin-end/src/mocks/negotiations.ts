import type { SpringPage } from '@/types/admin';
import { ApiClientError } from '@/types/api';
import type {
  ChatMessageSummary,
  ChatRoomSummary,
  NegotiationSummary,
} from '@/types/negotiations';

const now = Date.now();

const negotiations: NegotiationSummary[] = [
  {
    id: 'neg-1',
    p2pRequestId: 'req-1',
    requesterId: 'u-2',
    counterpartyId: 'u-3',
    status: 'PENDING',
    currentOfferId: 'off-2',
    offers: [
      {
        id: 'off-1',
        amount: '140000',
        rate: '1048.00',
        offeredBy: 'u-3',
        createdAt: new Date(now - 7200000).toISOString(),
      },
      {
        id: 'off-2',
        amount: '150000',
        rate: '1050.25',
        offeredBy: 'u-2',
        createdAt: new Date(now - 3600000).toISOString(),
      },
    ],
    createdAt: new Date(now - 8000000).toISOString(),
  },
];

const rooms: ChatRoomSummary[] = [
  {
    id: 'room-1',
    p2pOrderId: 'ord-1',
    participantAId: 'u-3',
    participantBId: 'u-5',
    createdAt: new Date(now - 7000000).toISOString(),
  },
];

const messages: Record<string, ChatMessageSummary[]> = {
  'room-1': [
    {
      id: 'msg-1',
      roomId: 'room-1',
      senderId: 'u-3',
      content: '[mock] Meeting point confirmed',
      createdAt: new Date(now - 6800000).toISOString(),
    },
  ],
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

export function mockListNegotiations(params?: {
  page?: number;
  size?: number;
  userId?: string;
  status?: string;
}): SpringPage<NegotiationSummary> {
  const userId = params?.userId;
  const filtered = negotiations.filter(
    (row) =>
      (!userId || row.requesterId === userId || row.counterpartyId === userId) &&
      (!params?.status || row.status === params.status),
  );
  const rows = filtered.map((row) => ({
    ...row,
    offers: row.offers?.map((offer) => ({ ...offer })),
  }));
  return toPage(rows, params?.page ?? 0, params?.size ?? 20);
}

export function mockGetNegotiation(id: string): NegotiationSummary {
  const found = negotiations.find((row) => row.id === id);
  if (!found) {
    throw new ApiClientError(404, 'RESOURCE_NOT_FOUND', 'Negotiation not found');
  }
  return {
    ...found,
    offers: found.offers?.map((offer) => ({ ...offer })),
  };
}

export function mockListChatRooms(params?: {
  page?: number;
  size?: number;
  userId?: string;
}): SpringPage<ChatRoomSummary> {
  const userId = params?.userId;
  return toPage(
    rooms
      .filter((row) => !userId || row.participantAId === userId || row.participantBId === userId)
      .map((row) => ({ ...row })),
    params?.page ?? 0,
    params?.size ?? 20,
  );
}

export function mockGetChatRoom(roomId: string): ChatRoomSummary {
  const found = rooms.find((row) => row.id === roomId);
  if (!found) {
    throw new ApiClientError(404, 'RESOURCE_NOT_FOUND', 'Chat room not found');
  }
  return { ...found };
}

export function mockListChatMessages(
  roomId: string,
  params?: { page?: number; size?: number },
): SpringPage<ChatMessageSummary> {
  const rows = (messages[roomId] ?? []).map((row) => ({ ...row }));
  return toPage(rows, params?.page ?? 0, params?.size ?? 20);
}
