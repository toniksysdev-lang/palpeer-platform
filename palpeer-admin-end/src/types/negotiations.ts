export type NegotiationOfferSummary = {
  id?: string;
  amount?: string | number;
  rate?: string | number;
  offeredBy?: string;
  createdAt?: string;
};

export type NegotiationSummary = {
  id: string;
  p2pRequestId: string;
  requesterId: string;
  counterpartyId: string;
  status: string;
  currentOfferId?: string | null;
  offers?: NegotiationOfferSummary[];
  createdAt: string;
};

export type ChatRoomSummary = {
  id: string;
  p2pOrderId: string;
  participantAId: string;
  participantBId: string;
  createdAt: string;
};

export type ChatMessageSummary = {
  id: string;
  roomId: string;
  senderId: string;
  content: string;
  clientMessageId?: string | null;
  createdAt: string;
};
