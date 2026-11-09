import { skipToken } from '@reduxjs/toolkit/query';
import { useCallback, useMemo, useState } from 'react';
import type { RefObject } from 'react';
import type { View } from 'react-native';

import { formatRateLine } from '@/features/exchange/format';
import {
  ALL_TIME_FROM,
  dayLabel,
  describeTransaction,
  groupByDay,
  inProgressCount,
  PERIOD_OPTIONS,
  periodFrom,
  recordedSteps,
  TRANSACTION_TYPES,
  transactionPollMs,
  TYPE_OPTIONS,
  type Period,
  type TypeFilter,
  typeLabel,
  uniqueItems,
} from '@/features/transactions/logic';
import {
  saveReceiptContentAsImage,
  saveReceiptContentAsPdf,
  type ReceiptContent,
} from '@/features/transactions/saveReceipt';
import { destinationAccountRows } from '@/features/wallets/destination';
import { useToast } from '@/providers/ToastProvider';
import { badgeLabel } from '@/features/notifications/logic';
import { useGetUnreadCountQuery } from '@/services/api/notificationApi';
import {
  useGetTransactionHistoryInfiniteQuery,
  useGetTransactionQuery,
  useGetTransactionSummaryQuery,
} from '@/services/api/transactionApi';
import {
  useGetWithdrawalBanksQuery,
  useGetWithdrawalQuery,
} from '@/services/api/walletApi';
import { useAppSelector } from '@/store';
import type { TransactionItemResponse } from '@/types/api/transaction';
import { formatDateTime } from '@/utils/datetime';
import { formatMoney } from '@/utils/money';
import { humanizeStatus } from '@/utils/status';

import { formatDesignMoney } from './currencyMeta';

const SWAP = 'M3 8h17M15 3l5 5-5 5M21 16H4M9 11l-5 5 5 5';
const PEOPLE =
  'M9 8m-3.600 0a3.600 3.600 0 1 0 7.200 0a3.600 3.600 0 1 0-7.200 0M2.500 20c0-3.600 2.800-6 6.500-6s6.500 2.400 6.500 6M15.500 4.700a3.600 3.600 0 0 1 0 6.600M18 14.600c2.100.8 3.500 2.800 3.500 5.400';
const SEND =
  'M9 8m-4 0a4 4 0 1 0 8 0a4 4 0 1 0-8 0M2 21c0-4 3-6.500 7-6.500s7 2.500 7 6.500M16 11h6M19 8l3 3-3 3';
const BANK = 'M3 10l9-6 9 6zM6 10v8M12 10v8M18 10v8M3 21h18';
const PLUS = 'M12 4v16M4 12h16';
const GIFT =
  'M12 8v13M20 12v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9M3.5 8h17v3a1 1 0 0 1-1 1H4.5a1 1 0 0 1-1-1V8zM7.5 8a2.5 2.5 0 1 1 0-5C9.5 3 12 5.5 12 8M16.5 8a2.5 2.5 0 1 0 0-5C14.5 3 12 5.5 12 8';

const STATUS_COLOR: Record<string, string> = {
  Done: '#0B6E4F',
  Waiting: '#A84C08',
  'Not done': '#B3231A',
  'Money returned': '#1D5BC7',
  Closed: '#46574F',
  'Held for review': '#A84C08',
};

function designStatus(status: string): string {
  switch (status) {
    case 'SUCCESS':
    case 'COMPLETED':
    case 'ACCEPTED':
    case 'GRANTED':
      return 'Done';
    case 'PENDING':
    case 'INITIATED':
    case 'PROCESSING':
      return 'Waiting';
    case 'FAILED':
      return 'Not done';
    case 'REVERSED':
      return 'Money returned';
    case 'EXPIRED':
    case 'CANCELLED':
    case 'CANCELED':
      return 'Closed';
    case 'UNDER_REVIEW':
    case 'HELD':
      return 'Held for review';
    default:
      return humanizeStatus(status);
  }
}

function typeMeta(type: TransactionItemResponse['type']) {
  switch (type) {
    case 'FUNDING':
      return { title: 'Added money', color: '#0B6E4F', icon: PLUS };
    case 'EXCHANGE':
      return { title: 'Changed money', color: '#A84C08', icon: SWAP };
    case 'P2P':
      return { title: 'Changed with a person', color: '#1D5BC7', icon: PEOPLE };
    case 'TRANSFER':
      return { title: 'Sent money', color: '#1D5BC7', icon: SEND };
    case 'WITHDRAWAL':
      return { title: 'Took out money', color: '#5E3AB8', icon: BANK };
    case 'BONUS':
      return { title: 'Bonus', color: '#0B6E4F', icon: GIFT };
    default:
      return { title: typeLabel(type), color: '#46574F', icon: PLUS };
  }
}

function moneyLine(tx: TransactionItemResponse): string {
  const amt = formatDesignMoney(tx.currencyCode, Number.parseFloat(tx.amount) || 0);
  if (
    (tx.type === 'EXCHANGE' || tx.type === 'P2P') &&
    tx.secondaryAmount &&
    tx.secondaryCurrencyCode
  ) {
    const secondary = formatDesignMoney(
      tx.secondaryCurrencyCode,
      Number.parseFloat(tx.secondaryAmount) || 0,
    );
    return `${amt} to ${secondary}`;
  }
  return amt;
}

function clock(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function buildRows(tx: TransactionItemResponse): [string, string][] {
  const amt = formatDesignMoney(tx.currencyCode, Number.parseFloat(tx.amount) || 0);
  const secondary =
    tx.secondaryAmount && tx.secondaryCurrencyCode
      ? formatDesignMoney(tx.secondaryCurrencyCode, Number.parseFloat(tx.secondaryAmount) || 0)
      : null;
  const rate =
    tx.appliedRate && tx.secondaryCurrencyCode
      ? formatRateLine(tx.appliedRate, tx.currencyCode, tx.secondaryCurrencyCode)
      : tx.appliedRate
        ? formatMoney(tx.appliedRate, { currencyCode: '', showCurrency: false })
        : null;

  switch (tx.type) {
    case 'FUNDING':
      return [
        ['You added', amt],
        ['Fee', 'No fee'],
        ['Wallet', `${tx.currencyCode} wallet`],
        ['Status', humanizeStatus(tx.status)],
        ['Reference', tx.id],
      ];
    case 'EXCHANGE':
      return [
        ['You gave', amt],
        ...(secondary ? ([['You got', secondary]] as [string, string][]) : []),
        ...(rate ? ([['Price', rate]] as [string, string][]) : []),
        ['Status', humanizeStatus(tx.status)],
        ['Reference', tx.id],
      ];
    case 'P2P':
      return [
        ['You gave', amt],
        ...(secondary ? ([['You got', secondary]] as [string, string][]) : []),
        ...(rate ? ([['Price', rate]] as [string, string][]) : []),
        ['Status', humanizeStatus(tx.status)],
        ['Reference', tx.id],
      ];
    case 'TRANSFER':
      return [
        ['You sent', amt],
        ['To', 'A Palpeer user'],
        ['Wallet', `${tx.currencyCode} wallet`],
        ['Status', humanizeStatus(tx.status)],
        ['Reference', tx.id],
      ];
    case 'WITHDRAWAL':
      return [
        ['You withdrew', amt],
        ['To', 'My bank'],
        ['Wallet', `${tx.currencyCode} wallet`],
        ['Status', humanizeStatus(tx.status)],
        ['Reference', tx.id],
      ];
    case 'BONUS':
      return [
        ['Bonus', amt],
        ['Wallet', `${tx.currencyCode} wallet`],
        ['Status', humanizeStatus(tx.status)],
        ['Reference', tx.id],
      ];
    default:
      return [
        ['Amount', amt],
        ['Status', humanizeStatus(tx.status)],
        ['Reference', tx.id],
      ];
  }
}

function withWithdrawalDestination(
  rows: [string, string][],
  currencyCode: string,
  destinationReference: string | null | undefined,
  bankName?: string | null,
): [string, string][] {
  const destination = destinationAccountRows(currencyCode, destinationReference, bankName);
  const withoutTo = rows.filter(([label]) => label !== 'To');
  const amountIdx = withoutTo.findIndex(([label]) => label === 'You withdrew');
  if (amountIdx < 0) return [...destination, ...withoutTo];
  return [
    ...withoutTo.slice(0, amountIdx + 1),
    ...destination,
    ...withoutTo.slice(amountIdx + 1),
  ];
}

export type HistoryListItem = {
  key: string;
  type: TransactionItemResponse['type'];
  id: string;
  title: string;
  line: string;
  time: string;
  dayLabel: string;
  color: string;
  icon: string;
  status: string;
  note: string;
  color2: string;
  rows: [string, string][];
  steps: string[];
  when: string;
  reference: string;
};

function mapItem(tx: TransactionItemResponse, now: number): HistoryListItem {
  const meta = typeMeta(tx.type);
  const status = designStatus(tx.status);
  const described = describeTransaction(tx);
  return {
    key: `${tx.type}-${tx.id}`,
    type: tx.type,
    id: tx.id,
    title: meta.title,
    line: moneyLine(tx),
    time: clock(tx.createdAt),
    dayLabel: dayLabel(tx.createdAt, now),
    color: meta.color,
    icon: meta.icon,
    status,
    note: tx.failureReason || described.message || 'The money moved.',
    color2: STATUS_COLOR[status] ?? '#46574F',
    rows: buildRows(tx),
    steps: recordedSteps(tx),
    when: formatDateTime(tx.createdAt) ?? clock(tx.createdAt),
    reference: tx.id,
  };
}

function toReceiptContent(detail: HistoryListItem): ReceiptContent {
  return {
    title: detail.title,
    rows: detail.rows.map(([label, value]) => ({ label, value })),
    status: detail.status,
    note: detail.note,
    when: detail.when,
    steps: detail.steps,
  };
}

function formatTotals(
  rows: readonly { currencyCode: string; totalAmount: string }[],
): string {
  if (!rows.length) return 'None';
  return rows
    .map((row) => formatDesignMoney(row.currencyCode, Number.parseFloat(row.totalAmount) || 0))
    .join(' · ');
}

/** Live History: filters, summary stats, paginated feed, detail + save image/PDF. */
export function useLiveHistory() {
  const toast = useToast();
  const authenticated = useAppSelector((s) => s.session.status === 'authenticated');
  const [type, setType] = useState<TypeFilter>('ALL');
  const [period, setPeriod] = useState<Period>('ALL');
  const [from, setFrom] = useState<string | undefined>(undefined);
  const [selected, setSelected] = useState<{
    type: TransactionItemResponse['type'];
    id: string;
  } | null>(null);
  const [savingFormat, setSavingFormat] = useState<'image' | 'pdf' | null>(null);

  const history = useGetTransactionHistoryInfiniteQuery(
    { type: type === 'ALL' ? undefined : type, from },
    { skip: !authenticated },
  );
  const summary = useGetTransactionSummaryQuery(
    { from: from ?? ALL_TIME_FROM },
    { skip: !authenticated },
  );
  const notifUnread = useGetUnreadCountQuery(undefined, { skip: !authenticated });

  const firstDetail = useGetTransactionQuery(selected ?? skipToken);
  const detailQ = useGetTransactionQuery(selected ?? skipToken, {
    pollingInterval: transactionPollMs(firstDetail.data),
    skipPollingIfUnfocused: true,
  });
  const withdrawalQ = useGetWithdrawalQuery(
    selected?.type === 'WITHDRAWAL' ? selected.id : skipToken,
  );
  const banksQ = useGetWithdrawalBanksQuery(
    selected?.type === 'WITHDRAWAL' ? undefined : skipToken,
  );

  const now = Date.now();
  const rawItems = useMemo(() => uniqueItems(history.data?.pages), [history.data?.pages]);
  const liveItems = useMemo(() => rawItems.map((tx) => mapItem(tx, now)), [now, rawItems]);

  const groups = useMemo(() => {
    const byDay = groupByDay(rawItems, now);
    return byDay.map((g) => ({
      key: g.key,
      label: g.label,
      items: g.items.map((tx) => mapItem(tx, now)),
    }));
  }, [now, rawItems]);

  const periodTitle = PERIOD_OPTIONS.find((o) => o.key === period)?.title ?? 'All time';
  const typeTitle = TYPE_OPTIONS.find((o) => o.key === type)?.title ?? 'All types';

  const stats = useMemo(() => {
    const data = summary.data;
    if (!data) {
      return {
        periodTitle,
        totalText: history.isLoading ? 'Loading…' : '0 transactions',
        countsText: '',
        moneyIn: 'None',
        moneyOut: 'None',
        footer: '',
      };
    }
    const counts = TRANSACTION_TYPES.map(
      (t) => `${data.countByType[t] ?? 0} ${typeLabel(t).toLowerCase()}`,
    ).join(' · ');
    const open = inProgressCount(data);
    return {
      periodTitle,
      totalText: data.totalCount === 1 ? '1 transaction' : `${data.totalCount} transactions`,
      countsText: counts,
      moneyIn: formatTotals(data.successfulFundingByCurrency),
      moneyOut: formatTotals(data.successfulWithdrawalByCurrency),
      footer:
        `${data.successfulExchangeCount} completed ${
          data.successfulExchangeCount === 1 ? 'exchange' : 'exchanges'
        }` + (open > 0 ? ` · ${open} in progress` : ''),
    };
  }, [history.isLoading, periodTitle, summary.data]);

  const listItemForSelected = useMemo(() => {
    if (!selected) return null;
    return liveItems.find((i) => i.type === selected.type && i.id === selected.id) ?? null;
  }, [liveItems, selected]);

  const bankNameForWithdrawal = useMemo(() => {
    const reference = withdrawalQ.data?.destinationReference;
    if (!reference || withdrawalQ.data?.currencyCode !== 'NGN') return null;
    const [bankCode] = reference.split(/[:|;]/);
    return banksQ.data?.find((b) => b.code === bankCode)?.name ?? null;
  }, [banksQ.data, withdrawalQ.data?.currencyCode, withdrawalQ.data?.destinationReference]);

  const detail = useMemo(() => {
    if (!selected) return null;
    const base = detailQ.data ? mapItem(detailQ.data, now) : listItemForSelected;
    if (!base) return null;
    if (base.type !== 'WITHDRAWAL') return base;
    const currencyCode = detailQ.data?.currencyCode ?? withdrawalQ.data?.currencyCode;
    const destinationReference = withdrawalQ.data?.destinationReference;
    if (!currencyCode || destinationReference == null) return base;
    return {
      ...base,
      rows: withWithdrawalDestination(
        base.rows,
        currencyCode,
        destinationReference,
        bankNameForWithdrawal,
      ),
    };
  }, [
    bankNameForWithdrawal,
    detailQ.data,
    listItemForSelected,
    now,
    selected,
    withdrawalQ.data?.currencyCode,
    withdrawalQ.data?.destinationReference,
  ]);

  const choosePeriod = useCallback((next: Period) => {
    setPeriod(next);
    setFrom(periodFrom(next, Date.now()));
    setSelected(null);
  }, []);

  const chooseType = useCallback((next: TypeFilter) => {
    setType(next);
    setSelected(null);
  }, []);

  const clearFilters = useCallback(() => {
    setType('ALL');
    setPeriod('ALL');
    setFrom(undefined);
    setSelected(null);
  }, []);

  const onOpenDetail = useCallback((typeKey: TransactionItemResponse['type'], id: string) => {
    setSelected({ type: typeKey, id });
  }, []);

  const onCloseDetail = useCallback(() => {
    setSelected(null);
  }, []);

  const onLoadMore = useCallback(() => {
    if (history.hasNextPage && !history.isFetchingNextPage) {
      void history.fetchNextPage();
    }
  }, [history]);

  const onSaveImage = useCallback(
    async (ref: RefObject<View | null>) => {
      if (!detail || savingFormat) return;
      setSavingFormat('image');
      try {
        await saveReceiptContentAsImage(
          toReceiptContent(detail),
          `palpeer-${detail.type}-${detail.id}`,
          ref,
        );
      } catch {
        toast.show({ type: 'error', title: "Couldn't save image" });
      } finally {
        setSavingFormat(null);
      }
    },
    [detail, savingFormat, toast],
  );

  const onSavePdf = useCallback(
    async (_ref: RefObject<View | null>) => {
      if (!detail || savingFormat) return;
      setSavingFormat('pdf');
      try {
        await saveReceiptContentAsPdf(
          toReceiptContent(detail),
          `palpeer-${detail.type}-${detail.id}`,
        );
      } catch {
        toast.show({ type: 'error', title: "Couldn't save PDF" });
      } finally {
        setSavingFormat(null);
      }
    },
    [detail, savingFormat, toast],
  );

  const unreadCount = notifUnread.data ?? 0;
  const msgBadge = badgeLabel(unreadCount) ?? '';

  const filtering = type !== 'ALL' || period !== 'ALL';

  return {
    backend: true as const,
    liveItems,
    groups,
    stats,
    typeTitle,
    periodTitle,
    typeOptions: TYPE_OPTIONS.map((o) => ({
      key: o.key,
      title: o.title,
      note: o.key === 'ALL' ? 'Every kind of money move' : `Only ${o.title.toLowerCase()}`,
      pick: () => chooseType(o.key),
      selected: type === o.key,
    })),
    periodOptions: PERIOD_OPTIONS.map((o) => ({
      key: o.key,
      title: o.title,
      note:
        o.key === 'ALL'
          ? 'From the start'
          : o.key === '7D'
            ? 'This week'
            : o.key === '30D'
              ? 'This month'
              : 'Last 3 months',
      pick: () => choosePeriod(o.key),
      selected: period === o.key,
    })),
    filtering,
    clearFilters,
    detailOpen: !!selected,
    detail,
    detailLoading: !!selected && !detail && detailQ.isLoading,
    onOpenDetail,
    onCloseDetail,
    onLoadMore,
    hasMore: !!history.hasNextPage,
    loadingMore: history.isFetchingNextPage,
    historyLoading: history.isLoading,
    empty: !history.isLoading && liveItems.length === 0,
    onSaveImage,
    onSavePdf,
    savingFormat,
    canSave: !!detail,
    msgBadge,
  };
}
