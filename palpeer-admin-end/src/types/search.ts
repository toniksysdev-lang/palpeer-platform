import type { AdminUserSummary } from '@/types/admin';

export const SEARCH_MATCH_TYPES = [
  'USER',
  'WALLET',
  'CARD',
  'KYC_CASE',
  'P2P_REQUEST',
  'P2P_ORDER',
  'NEGOTIATION',
  'CHAT_ROOM',
  'REFERRAL',
  'TRANSACTION',
] as const;

export type SearchMatchType = (typeof SEARCH_MATCH_TYPES)[number];

export type AdminSearchMatch = {
  type: SearchMatchType | string;
  id: string;
  label: string;
  path: string;
};

export type AdminSearchResponse = {
  query: string;
  users: AdminUserSummary[];
  matches: AdminSearchMatch[];
};
