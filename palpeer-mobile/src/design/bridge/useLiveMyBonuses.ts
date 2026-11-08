import { useCallback, useMemo } from 'react';

import { bonusStatusLabel } from '@/features/promotions/logic';
import { useMoneyFormat } from '@/features/wallets/useMoneyFormat';
import {
  useGetMyBonusSummaryQuery,
  useGetMyBonusesInfiniteQuery,
} from '@/services/api/promotionApi';
import { useAppSelector } from '@/store';
import { formatDateTime } from '@/utils/datetime';

/** Live props for design MyBonuses screen. */
export function useLiveMyBonuses() {
  const authenticated = useAppSelector((s) => s.session.status === 'authenticated');
  const { format } = useMoneyFormat();
  const summaryQ = useGetMyBonusSummaryQuery(undefined, { skip: !authenticated });
  const bonusesQ = useGetMyBonusesInfiniteQuery(undefined, { skip: !authenticated });

  const summary = useMemo(() => {
    return (summaryQ.data ?? []).map((row) => ({
      currencyCode: row.currencyCode,
      totalText: format(row.totalAmount, row.currencyCode),
      unusedText: format(row.unusedAmount, row.currencyCode),
      usedText: format(row.usedAmount, row.currencyCode),
    }));
  }, [format, summaryQ.data]);

  const items = useMemo(() => {
    const rows = bonusesQ.data?.pages.flatMap((page) => page.content) ?? [];
    return rows.map((bonus) => {
      const unused = bonus.status === 'PENDING';
      const used = !unused;
      return {
        unused,
        used,
        amountText: format(bonus.amount, bonus.currencyCode),
        note: `${bonus.reason ?? 'Bonus'} · ${formatDateTime(bonus.createdAt) ?? ''}`,
        statusLabel: bonusStatusLabel(bonus.status),
      };
    });
  }, [bonusesQ.data?.pages, format]);

  const onLoadMore = useCallback(() => {
    if (bonusesQ.hasNextPage && !bonusesQ.isFetchingNextPage) {
      void bonusesQ.fetchNextPage();
    }
  }, [bonusesQ]);

  return {
    backend: true as const,
    summary,
    items,
    hasMore: !!bonusesQ.hasNextPage,
    loadingMore: bonusesQ.isFetchingNextPage,
    onLoadMore,
  };
}
