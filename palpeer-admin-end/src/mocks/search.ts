import { transactionDetailPath } from '@/features/transactions/transactionPaths';
import { mockListCards } from '@/mocks/cards';
import { mockListKycCases } from '@/mocks/kyc';
import { mockListChatRooms, mockListNegotiations } from '@/mocks/negotiations';
import { mockListP2POrders, mockListP2PRequests } from '@/mocks/p2p';
import { mockListAdminReferrals } from '@/mocks/promotions';
import { mockSearchTransactions } from '@/mocks/transactions';
import { mockUsersCatalog } from '@/mocks/users';
import { mockListWallets } from '@/mocks/wallets';
import type { AdminSearchMatch, AdminSearchResponse } from '@/types/search';

const ALL = { page: 0, size: 1000 };

export function mockAdminSearch(q: string, can: (permission: string) => boolean): AdminSearchResponse {
  const query = q.trim();
  const needle = query.toLowerCase();
  const users = can('users:read')
    ? mockUsersCatalog
        .filter(
          (user) =>
            user.email.toLowerCase().includes(needle) ||
            (user.phone ?? '').toLowerCase().includes(needle),
        )
        .slice(0, 10)
        .map((user) => ({ ...user }))
    : [];

  const matches: AdminSearchMatch[] = [];
  const exact = (id: string) => id.toLowerCase() === needle;

  if (can('users:read')) {
    mockUsersCatalog
      .filter((user) => exact(user.id))
      .forEach((user) =>
        matches.push({ type: 'USER', id: user.id, label: user.email, path: `/admin/users/${user.id}` }),
      );
  }
  if (can('wallets:read')) {
    mockListWallets(ALL)
      .content.filter((wallet) => exact(wallet.id))
      .forEach((wallet) =>
        matches.push({
          type: 'WALLET',
          id: wallet.id,
          label: `${wallet.currencyCode} wallet`,
          path: `/admin/wallets/${wallet.id}`,
        }),
      );
  }
  if (can('cards:read')) {
    mockListCards(ALL)
      .content.filter((card) => exact(card.id))
      .forEach((card) =>
        matches.push({
          type: 'CARD',
          id: card.id,
          label: `${card.brand ?? 'Card'} •••• ${card.lastFour}`,
          path: `/admin/cards/${card.id}`,
        }),
      );
  }
  if (can('kyc:read')) {
    mockListKycCases(ALL)
      .content.filter((row) => exact(row.caseId))
      .forEach((row) =>
        matches.push({
          type: 'KYC_CASE',
          id: row.caseId,
          label: `KYC case · ${row.status}`,
          path: `/admin/kyc/${row.caseId}`,
        }),
      );
  }
  if (can('p2p:read')) {
    mockListP2PRequests()
      .filter((row) => exact(row.id))
      .forEach((row) =>
        matches.push({
          type: 'P2P_REQUEST',
          id: row.id,
          label: `${row.side} ${row.baseCurrencyCode}/${row.quoteCurrencyCode}`,
          path: `/admin/p2p/${row.id}?kind=request`,
        }),
      );
    mockListP2POrders()
      .filter((row) => exact(row.id))
      .forEach((row) =>
        matches.push({
          type: 'P2P_ORDER',
          id: row.id,
          label: `P2P order · ${row.status}`,
          path: `/admin/p2p/${row.id}?kind=order`,
        }),
      );
  }
  if (can('negotiations:read')) {
    mockListNegotiations(ALL)
      .content.filter((row) => exact(row.id))
      .forEach((row) =>
        matches.push({
          type: 'NEGOTIATION',
          id: row.id,
          label: `Negotiation · ${row.status}`,
          path: `/admin/negotiations/${row.id}`,
        }),
      );
  }
  if (can('chat:read')) {
    mockListChatRooms(ALL)
      .content.filter((row) => exact(row.id))
      .forEach((row) =>
        matches.push({
          type: 'CHAT_ROOM',
          id: row.id,
          label: 'Chat room',
          path: `/admin/chat?room=${row.id}`,
        }),
      );
  }
  if (can('promotions:write')) {
    mockListAdminReferrals(ALL)
      .content.filter((row) => exact(row.id))
      .forEach((row) =>
        matches.push({
          type: 'REFERRAL',
          id: row.id,
          label: `Referral ${row.referralCode}`,
          path: `/admin/referrals/${row.id}`,
        }),
      );
  }
  if (can('transactions:read')) {
    mockSearchTransactions({ page: 0, size: 1000 })
      .items.filter((row) => exact(row.id))
      .forEach((row) =>
        matches.push({
          type: 'TRANSACTION',
          id: row.id,
          label: `${row.type} · ${row.status}`,
          path: transactionDetailPath(row),
        }),
      );
  }

  return { query, users, matches };
}
