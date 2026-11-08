import { useCallback, useMemo } from 'react';
import { router, type Href } from 'expo-router';

import { formatPoints, pointsEntryLabel } from '@/features/loyalty/logic';
import { useMoneyFormat } from '@/features/wallets/useMoneyFormat';
import {
  useGetMyLoyaltyPointsBalanceQuery,
  useGetMyLoyaltyPointsLedgerInfiniteQuery,
} from '@/services/api/promotionApi';
import { useAppSelector } from '@/store';
import { formatDateTime } from '@/utils/datetime';

/** Live props for design MyPoints screen. */
export function useLiveMyPoints() {
  const authenticated = useAppSelector((s) => s.session.status === 'authenticated');
  const { format } = useMoneyFormat();
  const balanceQ = useGetMyLoyaltyPointsBalanceQuery(undefined, { skip: !authenticated });
  const ledgerQ = useGetMyLoyaltyPointsLedgerInfiniteQuery(undefined, { skip: !authenticated });

  const balance = balanceQ.data;
  const entries = useMemo(() => {
    const rows = ledgerQ.data?.pages.flatMap((page) => page.content) ?? [];
    return rows.map((entry) => {
      const earned = entry.entryType === 'EARNED';
      return {
        pointsLabel: `${earned ? '+' : '−'}${formatPoints(entry.points)}`,
        statusLabel: pointsEntryLabel(entry),
        tone: earned ? 'earned' : 'used',
        note: `${entry.reason ?? 'Referral points'} · ${formatDateTime(entry.createdAt) ?? ''}`,
        cadLabel: format(entry.cadAmount, entry.currencyCode || 'CAD'),
      };
    });
  }, [format, ledgerQ.data?.pages]);

  const onInvite = useCallback(() => {
    router.push('/InviteFriends' as Href);
  }, []);

  const onLoadMore = useCallback(() => {
    if (ledgerQ.hasNextPage && !ledgerQ.isFetchingNextPage) {
      void ledgerQ.fetchNextPage();
    }
  }, [ledgerQ]);

  return {
    backend: true as const,
    balancePoints: balance?.balancePoints ?? 0,
    balanceCadText: format(balance?.balanceCad ?? '0', balance?.currencyCode || 'CAD'),
    earnedPoints: balance?.earnedPoints ?? 0,
    usedPoints: balance?.usedPoints ?? 0,
    pointsPerCad: balance?.pointsPerCad ?? 100,
    entries,
    hasMore: !!ledgerQ.hasNextPage,
    loadingMore: ledgerQ.isFetchingNextPage,
    onInvite,
    onLoadMore,
  };
}
