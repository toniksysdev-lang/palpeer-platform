import { skipToken } from '@reduxjs/toolkit/query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { badgeLabel, messagesMenuCount } from '@/features/notifications/logic';
import { useGetChatUnreadCountQuery } from '@/services/api/chatApi';
import {
  ALERTS,
  ALERTS_POLL_MS,
  useGetUnreadCountQuery,
} from '@/services/api/notificationApi';
import { baseApi } from '@/services/api/baseApi';
import {
  useGetTransactionHistoryInfiniteQuery,
  useGetTransactionQuery,
  useGetTransactionSummaryQuery,
} from '@/services/api/transactionApi';
import { isInProgress } from '@/features/wallets/movementStatus';
import {
  useGetFundingQuery,
  useGetWithdrawalBanksQuery,
  useGetWithdrawalQuery,
  walletBalanceTags,
} from '@/services/api/walletApi';
import { useAppDispatch, useAppSelector } from '@/store';
import type { TransactionItemResponse } from '@/types/api/transaction';
import type { FundingPaymentDetails, FundingTransactionResponse } from '@/types/api/wallet';
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
      return { title: 'Withdrew money', color: '#5E3AB8', icon: BANK };
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
    case 'FUNDING': {
      const awaiting = isInProgress(tx.status);
      return [
        [awaiting ? 'You planned to add' : 'You added', amt],
        ['Fee', 'No fee'],
        ['Wallet', `${tx.currencyCode} wallet`],
        ['Status', humanizeStatus(tx.status)],
        ['Reference', tx.id],
      ];
    }
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

export type HistoryPaymentRow = { key: string; label: string; value: string; copy: string };

function fundingMethodLabel(funding: FundingTransactionResponse): string | null {
  if (funding.paymentDetails?.method === 'INTERAC_INSTANT' || funding.currencyCode === 'CAD') {
    return 'Interac e-Transfer';
  }
  if (funding.paymentDetails?.method === 'BANK_TRANSFER' || funding.providerName === 'KUDA') {
    return 'Bank transfer';
  }
  if (funding.providerName === 'APAYLO') return 'Interac e-Transfer';
  return funding.providerName;
}

function fundingPaymentRows(pay: FundingPaymentDetails): HistoryPaymentRow[] {
  const amt = formatDesignMoney(pay.currencyCode, Number.parseFloat(pay.amount) || 0);
  const isInterac = pay.method === 'INTERAC_INSTANT' || pay.currencyCode === 'CAD';
  const rows: HistoryPaymentRow[] = [];
  if (isInterac) {
    if (pay.collectionEmail) {
      rows.push({
        key: 'payTo',
        label: 'Send to',
        value: pay.collectionEmail,
        copy: pay.collectionEmail,
      });
    }
    rows.push({ key: 'amount', label: 'Amount', value: amt, copy: pay.amount });
    if (pay.trackingReference) {
      rows.push({
        key: 'memo',
        label: 'Message',
        value: pay.trackingReference,
        copy: pay.trackingReference,
      });
    } else if (pay.aplReference) {
      rows.push({
        key: 'apl',
        label: 'Message',
        value: pay.aplReference,
        copy: pay.aplReference,
      });
    }
    if (pay.interacEmail) {
      rows.push({
        key: 'from',
        label: 'Send from',
        value: pay.interacEmail,
        copy: pay.interacEmail,
      });
    }
    return rows;
  }
  if (pay.bankName) rows.push({ key: 'bank', label: 'Bank', value: pay.bankName, copy: pay.bankName });
  if (pay.accountName) {
    rows.push({ key: 'name', label: 'Account name', value: pay.accountName, copy: pay.accountName });
  }
  if (pay.accountNumber) {
    rows.push({
      key: 'number',
      label: 'Account number',
      value: pay.accountNumber,
      copy: pay.accountNumber,
    });
  }
  rows.push({ key: 'amount', label: 'Amount', value: amt, copy: pay.amount });
  if (pay.trackingReference) {
    rows.push({
      key: 'ref',
      label: 'Reference',
      value: pay.trackingReference,
      copy: pay.trackingReference,
    });
  }
  return rows;
}

function fundingNote(funding: FundingTransactionResponse): string {
  if (funding.failureReason) return funding.failureReason;
  switch (funding.status) {
    case 'INITIATED':
      return 'Nothing has been added to your wallet yet.';
    case 'PENDING':
      return 'Your balance updates once the payment arrives. Use the payment details below.';
    case 'PROCESSING':
      return 'This usually takes a few moments.';
    case 'SUCCESS':
      return 'The amount is in your available balance.';
    case 'FAILED':
      return 'Nothing was added to your wallet.';
    case 'REVERSED':
      return 'The amount was taken back out of your wallet.';
    default:
      return 'The money moved.';
  }
}

function fundingSteps(funding: FundingTransactionResponse): string[] {
  const steps: string[] = [];
  if (isInProgress(funding.status)) steps.push('Requested');
  if (funding.status === 'SUCCESS' || funding.ledgerEntryId) steps.push('Added to your wallet');
  if (funding.status === 'REVERSED' || funding.reversalLedgerEntryId) {
    steps.push('Taken back out of your wallet');
  }
  if (funding.status === 'FAILED') steps.push('Not completed');
  return steps;
}

function withFundingDetails(
  base: HistoryListItem,
  funding: FundingTransactionResponse | undefined,
): HistoryListItem {
  if (!funding) return base;
  const amt = formatDesignMoney(funding.currencyCode, Number.parseFloat(funding.amount) || 0);
  const awaiting = isInProgress(funding.status);
  const method = fundingMethodLabel(funding);
  const rows: [string, string][] = [
    [awaiting ? 'You planned to add' : 'You added', amt],
    ['Fee', 'No fee'],
    ['Wallet', `${funding.currencyCode} wallet`],
  ];
  if (method) rows.push(['How you pay', method]);
  rows.push(['Status', humanizeStatus(funding.status)]);
  if (funding.providerReference) rows.push(['Provider reference', funding.providerReference]);
  rows.push(['Reference', funding.id]);

  const pay = funding.paymentDetails;
  const paymentRows =
    awaiting && pay
      ? fundingPaymentRows(pay)
      : awaiting && funding.fundingInstructions
        ? [
            {
              key: 'instructions',
              label: 'Payment instructions',
              value: funding.fundingInstructions,
              copy: funding.fundingInstructions,
            },
          ]
        : [];

  const status = designStatus(funding.status);
  return {
    ...base,
    status,
    color2: STATUS_COLOR[status] ?? base.color2,
    note: fundingNote(funding),
    rows,
    steps: fundingSteps(funding),
    when: formatDateTime(funding.createdAt) ?? base.when,
    reference: funding.id,
    paymentTitle: awaiting
      ? pay?.method === 'INTERAC_INSTANT' || funding.currencyCode === 'CAD'
        ? 'Send Instant Interac'
        : 'Send from your bank'
      : null,
    paymentHint: awaiting
      ? funding.currencyCode === 'CAD'
        ? 'Send the exact amount. No security question. Your wallet updates when the payment arrives.'
        : 'Send the exact amount. Bank fees are shown by your bank. Your wallet updates when the payment arrives.'
      : null,
    paymentRows,
  };
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
  /** Bank / Interac payment step while funding is still awaiting confirmation. */
  paymentTitle?: string | null;
  paymentHint?: string | null;
  paymentRows?: HistoryPaymentRow[];
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

function shortDay(isoDay: string): string {
  const d = new Date(`${isoDay}T12:00:00`);
  if (Number.isNaN(d.getTime())) return isoDay;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Live History: filters, summary stats, paginated feed, detail + save image/PDF. */
export function useLiveHistory() {
  const toast = useToast();
  const authenticated = useAppSelector((s) => s.session.status === 'authenticated');
  const [type, setType] = useState<TypeFilter>('ALL');
  const [period, setPeriod] = useState<Period>('ALL');
  const [from, setFrom] = useState<string | undefined>(undefined);
  const [to, setTo] = useState<string | undefined>(undefined);
  const [customLabel, setCustomLabel] = useState<string | null>(null);
  const [selected, setSelected] = useState<{
    type: TransactionItemResponse['type'];
    id: string;
  } | null>(null);
  const [savingFormat, setSavingFormat] = useState<'image' | 'pdf' | null>(null);

  const history = useGetTransactionHistoryInfiniteQuery(
    { type: type === 'ALL' ? undefined : type, from, to },
    { skip: !authenticated },
  );
  const summary = useGetTransactionSummaryQuery(
    { from: from ?? ALL_TIME_FROM, to },
    { skip: !authenticated },
  );
  const dispatch = useAppDispatch();
  const notifUnread = useGetUnreadCountQuery(undefined, {
    skip: !authenticated,
    pollingInterval: authenticated ? ALERTS_POLL_MS : 0,
    skipPollingIfUnfocused: true,
  });
  const chatUnread = useGetChatUnreadCountQuery(undefined, {
    skip: !authenticated,
    pollingInterval: authenticated ? ALERTS_POLL_MS : 0,
    skipPollingIfUnfocused: true,
  });

  const firstDetail = useGetTransactionQuery(selected ?? skipToken);
  const detailQ = useGetTransactionQuery(selected ?? skipToken, {
    pollingInterval: transactionPollMs(firstDetail.data),
    skipPollingIfUnfocused: true,
  });
  const firstFunding = useGetFundingQuery(
    selected?.type === 'FUNDING' ? selected.id : skipToken,
  );
  const fundingQ = useGetFundingQuery(selected?.type === 'FUNDING' ? selected.id : skipToken, {
    pollingInterval: transactionPollMs(
      firstFunding.data
        ? ({ type: 'FUNDING', status: firstFunding.data.status } as TransactionItemResponse)
        : undefined,
    ),
    skipPollingIfUnfocused: true,
  });
  const firstWithdrawal = useGetWithdrawalQuery(
    selected?.type === 'WITHDRAWAL' ? selected.id : skipToken,
  );
  const withdrawalQ = useGetWithdrawalQuery(
    selected?.type === 'WITHDRAWAL' ? selected.id : skipToken,
    {
      pollingInterval: transactionPollMs(
        firstWithdrawal.data
          ? ({ type: 'WITHDRAWAL', status: firstWithdrawal.data.status } as TransactionItemResponse)
          : undefined,
      ),
      skipPollingIfUnfocused: true,
    },
  );

  // When History poll sees funding/withdrawal leave in-progress, refresh Home balances + Alerts.
  const lastFundingStatus = useRef<string | null>(null);
  const lastWithdrawalStatus = useRef<string | null>(null);
  useEffect(() => {
    const status = fundingQ.data?.status ?? null;
    const prev = lastFundingStatus.current;
    lastFundingStatus.current = status;
    if (!prev || !status || prev === status) return;
    if (isInProgress(prev) && !isInProgress(status)) {
      const walletId = fundingQ.data?.walletId;
      dispatch(
        baseApi.util.invalidateTags(
          walletId ? [...walletBalanceTags(walletId), ...ALERTS] : [...ALERTS],
        ),
      );
    }
  }, [dispatch, fundingQ.data?.status, fundingQ.data?.walletId]);
  useEffect(() => {
    const status = withdrawalQ.data?.status ?? null;
    const prev = lastWithdrawalStatus.current;
    lastWithdrawalStatus.current = status;
    if (!prev || !status || prev === status) return;
    if (isInProgress(prev) && !isInProgress(status)) {
      const walletId = withdrawalQ.data?.walletId;
      dispatch(
        baseApi.util.invalidateTags(
          walletId ? [...walletBalanceTags(walletId), ...ALERTS] : [...ALERTS],
        ),
      );
    }
  }, [dispatch, withdrawalQ.data?.status, withdrawalQ.data?.walletId]);
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

  const periodTitle =
    period === 'CUSTOM' && customLabel
      ? customLabel
      : PERIOD_OPTIONS.find((o) => o.key === period)?.title ?? 'All time';
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
    if (base.type === 'FUNDING') {
      return withFundingDetails(base, fundingQ.data);
    }
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
    fundingQ.data,
    listItemForSelected,
    now,
    selected,
    withdrawalQ.data?.currencyCode,
    withdrawalQ.data?.destinationReference,
  ]);

  const detailLoading =
    !!selected &&
    !detail &&
    (detailQ.isLoading ||
      (selected.type === 'FUNDING' && fundingQ.isLoading) ||
      (selected.type === 'WITHDRAWAL' && withdrawalQ.isLoading));

  const choosePeriod = useCallback((next: Exclude<Period, 'CUSTOM'>) => {
    setPeriod(next);
    setFrom(periodFrom(next, Date.now()));
    setTo(undefined);
    setCustomLabel(null);
    setSelected(null);
  }, []);

  const applyCustomRange = useCallback((fromIsoDay: string, toIsoDay: string) => {
    const fromStart = new Date(`${fromIsoDay}T00:00:00`);
    const toEnd = new Date(`${toIsoDay}T23:59:59.999`);
    if (Number.isNaN(fromStart.getTime()) || Number.isNaN(toEnd.getTime())) {
      return { ok: false as const, error: 'Pick valid From and To dates.' };
    }
    if (fromStart.getTime() > toEnd.getTime()) {
      return { ok: false as const, error: 'From must be on or before To.' };
    }
    setPeriod('CUSTOM');
    setFrom(fromStart.toISOString());
    setTo(toEnd.toISOString());
    setCustomLabel(`${shortDay(fromIsoDay)} – ${shortDay(toIsoDay)}`);
    setSelected(null);
    return { ok: true as const };
  }, []);

  const chooseType = useCallback((next: TypeFilter) => {
    setType(next);
    setSelected(null);
  }, []);

  const clearFilters = useCallback(() => {
    setType('ALL');
    setPeriod('ALL');
    setFrom(undefined);
    setTo(undefined);
    setCustomLabel(null);
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

  const unreadCount = messagesMenuCount(notifUnread.data, chatUnread.data);
  const msgBadge = badgeLabel(unreadCount) ?? '';

  const filtering = type !== 'ALL' || period !== 'ALL';

  const onRefresh = useCallback(() => {
    void history.refetch();
    void summary.refetch();
    void notifUnread.refetch();
    void chatUnread.refetch();
    if (selected) {
      void detailQ.refetch();
      if (selected.type === 'FUNDING') void fundingQ.refetch();
      if (selected.type === 'WITHDRAWAL') void withdrawalQ.refetch();
    }
  }, [chatUnread, detailQ, fundingQ, history, notifUnread, selected, summary, withdrawalQ]);

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
    periodOptions: [
      ...PERIOD_OPTIONS.map((o) => ({
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
      {
        key: 'CUSTOM',
        title: 'From / To',
        note: customLabel || 'Pick a start and end date on the calendar',
        pick: () => {
          /* History opens the calendar form for this key. */
        },
        selected: period === 'CUSTOM',
      },
    ],
    filtering,
    clearFilters,
    applyCustomRange,
    detailOpen: !!selected,
    detail,
    detailLoading,
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
    onRefresh,
  };
}
