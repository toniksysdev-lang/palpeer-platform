import { FUNDING_POLL_MS, IDLE_POLL_MS, isInProgress } from '@/features/wallets/movementStatus';
import type {
  TransactionActivityType,
  TransactionItemResponse,
  TransactionSummaryResponse,
} from '@/types/api/transaction';

export const TRANSACTION_TYPES: readonly TransactionActivityType[] = [
  'FUNDING',
  'WITHDRAWAL',
  'EXCHANGE',
  'TRANSFER',
  'P2P',
  'BONUS',
];

export function isTransactionType(value: unknown): value is TransactionActivityType {
  return typeof value === 'string' && (TRANSACTION_TYPES as readonly string[]).includes(value);
}

export function typeLabel(type: TransactionActivityType): string {
  switch (type) {
    case 'FUNDING':
      return 'Funding';
    case 'WITHDRAWAL':
      return 'Withdrawal';
    case 'EXCHANGE':
      return 'Exchange';
    case 'TRANSFER':
      return 'Transfer';
    case 'P2P':
      return 'P2P';
    case 'BONUS':
      return 'Bonus';
  }
}

export type TypeFilter = 'ALL' | TransactionActivityType;

export const TYPE_OPTIONS: readonly { key: TypeFilter; title: string }[] = [
  { key: 'ALL', title: 'All types' },
  { key: 'FUNDING', title: 'Funding' },
  { key: 'WITHDRAWAL', title: 'Withdrawals' },
  { key: 'EXCHANGE', title: 'Exchanges' },
  { key: 'TRANSFER', title: 'Transfers' },
  { key: 'P2P', title: 'P2P' },
  { key: 'BONUS', title: 'Bonuses' },
];

export type Period = 'ALL' | '7D' | '30D' | '90D';

const PERIOD_DAYS: Record<Exclude<Period, 'ALL'>, number> = { '7D': 7, '30D': 30, '90D': 90 };

export const PERIOD_OPTIONS: readonly { key: Period; title: string }[] = [
  { key: 'ALL', title: 'All time' },
  { key: '7D', title: 'Last 7 days' },
  { key: '30D', title: 'Last 30 days' },
  { key: '90D', title: 'Last 90 days' },
];

const DAY_MS = 24 * 60 * 60 * 1000;

/** Start of the period as an ISO instant; undefined for all time (the backend then starts at epoch). */
export function periodFrom(period: Period, now: number): string | undefined {
  if (period === 'ALL') return undefined;
  return new Date(now - PERIOD_DAYS[period] * DAY_MS).toISOString();
}

/** The summary defaults to the last 30 days, so "all time" asks from the epoch explicitly. */
export const ALL_TIME_FROM = '1970-01-01T00:00:00Z';

function localDayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/** "Today", "Yesterday" or "28 Sep 2026" in the device's time zone. */
export function dayLabel(iso: string, now: number): string {
  const date = new Date(iso);
  const today = new Date(now);
  const yesterday = new Date(now - DAY_MS);
  if (localDayKey(date) === localDayKey(today)) return 'Today';
  if (localDayKey(date) === localDayKey(yesterday)) return 'Yesterday';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export type DayGroup = { key: string; label: string; items: TransactionItemResponse[] };

/** Consecutive items grouped by local day, keeping the backend's newest-first order. */
export function groupByDay(items: readonly TransactionItemResponse[], now: number): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const item of items) {
    const key = localDayKey(new Date(item.createdAt));
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(item);
    else groups.push({ key, label: dayLabel(item.createdAt, now), items: [item] });
  }
  return groups;
}

/** Pages can overlap when new items arrive between page loads; each item is shown once. */
export function uniqueItems(
  pages: readonly { items: TransactionItemResponse[] }[] | undefined,
): TransactionItemResponse[] {
  const seen = new Set<string>();
  const items: TransactionItemResponse[] = [];
  for (const page of pages ?? []) {
    for (const item of page.items) {
      const key = `${item.type}-${item.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push(item);
    }
  }
  return items;
}

const sentence = (reason: string | null) => (reason ? `${reason.replace(/\.$/, '')}. ` : '');

/**
 * Status copy per VERIFIED behaviour (R-G-4, R-T-2): success is only claimed on SUCCESS. Unknown
 * statuses get neutral copy instead of a guess.
 */
export function describeTransaction(item: TransactionItemResponse): {
  title: string;
  message: string;
} {
  const target = item.secondaryCurrencyCode ?? 'target';
  switch (`${item.type}:${item.status}`) {
    case 'FUNDING:INITIATED':
      return { title: 'Funding requested', message: 'Nothing has been added to your wallet yet.' };
    case 'FUNDING:PENDING':
      return {
        title: 'Waiting for your payment',
        message:
          'Your balance updates once the payment arrives. Payment details has the instructions.',
      };
    case 'FUNDING:PROCESSING':
      return { title: 'Processing your payment', message: 'This usually takes a few moments.' };
    case 'FUNDING:SUCCESS':
      return { title: 'Funds added', message: 'The amount is in your available balance.' };
    case 'FUNDING:FAILED':
      return {
        title: 'Funding failed',
        message: `${sentence(item.failureReason)}Nothing was added to your wallet.`,
      };
    case 'FUNDING:REVERSED':
      return {
        title: 'Funding reversed',
        message: 'The amount was taken back out of your wallet.',
      };
    case 'WITHDRAWAL:INITIATED':
    case 'WITHDRAWAL:PENDING':
    case 'WITHDRAWAL:PROCESSING':
      return {
        title: 'Withdrawal in progress',
        message: 'The amount is held in your pending balance until the transfer completes.',
      };
    case 'WITHDRAWAL:SUCCESS':
      return { title: 'Withdrawal complete', message: 'The money has been sent.' };
    case 'WITHDRAWAL:FAILED':
      return {
        title: 'Withdrawal failed',
        message: `${sentence(item.failureReason)}The held amount was returned to your available balance.`,
      };
    case 'WITHDRAWAL:REVERSED':
      return { title: 'Withdrawal reversed', message: 'The amount was returned to your wallet.' };
    case 'EXCHANGE:INITIATED':
      return { title: 'Exchange in progress', message: 'This usually takes a moment.' };
    case 'EXCHANGE:SUCCESS':
      return { title: 'Exchange complete', message: `The money is in your ${target} wallet.` };
    case 'EXCHANGE:FAILED':
      return {
        title: 'Exchange failed',
        message: `${sentence(item.failureReason)}Nothing was exchanged.`,
      };
    case 'TRANSFER:SUCCESS':
      return {
        title: 'Transfer complete',
        message: item.failureReason
          ? `Note: ${item.failureReason}`
          : 'The money moved between Palpeer wallets.',
      };
    case 'P2P:ACCEPTED':
      return {
        title: 'P2P order accepted',
        message: item.failureReason
          ? `Note: ${item.failureReason}`
          : 'This peer trade was accepted and settled.',
      };
    case 'P2P:COMPLETED':
      return {
        title: 'P2P trade complete',
        message: item.failureReason
          ? `Note: ${item.failureReason}`
          : `Base and quote amounts moved between wallets${
              item.secondaryCurrencyCode ? ` (${item.currencyCode} ↔ ${item.secondaryCurrencyCode})` : ''
            }.`,
      };
    case 'BONUS:GRANTED':
      return {
        title: 'Bonus credited',
        message: item.failureReason
          ? item.failureReason
          : `Added to your ${item.currencyCode} wallet.`,
      };
    case 'BONUS:PENDING':
      return {
        title: 'Bonus pending',
        message: item.failureReason ?? 'This bonus is not in your wallet yet.',
      };
    default:
      return {
        title: typeLabel(item.type),
        message: 'Pull down to check for the latest status.',
      };
  }
}

/**
 * Ledger steps the backend has recorded for this transaction (keys per VERIFIED
 * `TransactionItemResponse.ledgerEntryIds`). Unknown keys are ignored.
 */
export function recordedSteps(item: TransactionItemResponse): string[] {
  const has = (key: string) => Boolean(item.ledgerEntryIds?.[key]);
  const steps: string[] = [];
  if (item.type === 'FUNDING') {
    if (has('credit')) steps.push('Added to your wallet');
    if (has('reversal')) steps.push('Taken back out of your wallet');
  } else if (item.type === 'WITHDRAWAL') {
    if (has('hold')) steps.push('Held in your pending balance');
    if (has('debit')) steps.push('Sent from your wallet');
    if (has('release')) steps.push('Returned to your available balance');
    if (has('reversal')) steps.push('Returned to your wallet after the payout');
  } else if (item.type === 'TRANSFER') {
    steps.push('Debited from the source wallet');
    steps.push('Credited to the destination wallet');
  } else if (item.type === 'P2P') {
    steps.push(`Base amount settled in ${item.currencyCode}`);
    if (item.secondaryCurrencyCode) {
      steps.push(`Quote amount settled in ${item.secondaryCurrencyCode}`);
    }
  } else if (item.type === 'BONUS') {
    if (has('credit')) steps.push(`Credited to your ${item.currencyCode} wallet`);
  } else {
    if (has('debit')) steps.push(`Taken from your ${item.currencyCode} wallet`);
    if (has('credit'))
      steps.push(`Added to your ${item.secondaryCurrencyCode ?? ''} wallet`.trim());
  }
  return steps;
}

/**
 * How often an open transaction is re-read. The feed doesn't say whether a payment rail is involved,
 * so an INITIATED funding or withdrawal is checked at the slower idle rate.
 */
export function transactionPollMs(item: TransactionItemResponse | undefined): number {
  if (!item || !isInProgress(item.status)) return 0;
  if (item.type !== 'EXCHANGE' && item.status === 'INITIATED') return IDLE_POLL_MS;
  return FUNDING_POLL_MS;
}

/** Transactions still in progress in a summary (counts only; never money). */
export function inProgressCount(summary: TransactionSummaryResponse): number {
  return Object.entries(summary.countByStatus).reduce((total, [key, count]) => {
    const status = key.split(':')[1] ?? '';
    return isInProgress(status) ? total + count : total;
  }, 0);
}
