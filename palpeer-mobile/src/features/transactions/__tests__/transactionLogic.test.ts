import {
  describeTransaction,
  groupByDay,
  inProgressCount,
  isTransactionType,
  periodFrom,
  recordedSteps,
  transactionPollMs,
  uniqueItems,
} from '../logic';
import { exchangeItem, item, summary, transferItem, withdrawalItem } from './fixtures';

const NOW = new Date(2026, 8, 29, 15, 0).getTime();
const at = (day: number, hour = 10) => new Date(2026, 8, day, hour, 0).toISOString();

describe('isTransactionType', () => {
  it('accepts only the backend types, case-sensitively', () => {
    expect(isTransactionType('FUNDING')).toBe(true);
    expect(isTransactionType('EXCHANGE')).toBe(true);
    expect(isTransactionType('TRANSFER')).toBe(true);
    expect(isTransactionType('P2P')).toBe(true);
    expect(isTransactionType('funding')).toBe(false);
    expect(isTransactionType(undefined)).toBe(false);
  });
});

describe('periodFrom', () => {
  it('is undefined for all time and counts whole days back otherwise', () => {
    expect(periodFrom('ALL', NOW)).toBeUndefined();
    expect(periodFrom('7D', NOW)).toBe(new Date(NOW - 7 * 86_400_000).toISOString());
    expect(periodFrom('90D', NOW)).toBe(new Date(NOW - 90 * 86_400_000).toISOString());
  });
});

describe('groupByDay', () => {
  it('groups by local day in the order the backend sent, with Today and Yesterday', () => {
    const groups = groupByDay(
      [
        item({ id: 'a', createdAt: at(29, 14) }),
        item({ id: 'b', createdAt: at(29, 9) }),
        item({ id: 'c', createdAt: at(28) }),
        item({ id: 'd', createdAt: at(20) }),
      ],
      NOW,
    );
    expect(groups[0]?.label).toBe('Today');
    expect(groups[1]?.label).toBe('Yesterday');
    expect(groups[2]?.label).not.toMatch(/Today|Yesterday/);
    expect(groups.map((group) => group.items.map((entry) => entry.id))).toEqual([
      ['a', 'b'],
      ['c'],
      ['d'],
    ]);
  });
});

describe('uniqueItems', () => {
  it('drops an item repeated on the next page (same type and id)', () => {
    const shared = item({ id: 'f-1' });
    const items = uniqueItems([
      { items: [item({ id: 'f-2' }), shared] },
      { items: [shared, exchangeItem({ id: 'f-1' })] },
    ]);
    expect(items.map((entry) => `${entry.type}-${entry.id}`)).toEqual([
      'FUNDING-f-2',
      'FUNDING-f-1',
      'EXCHANGE-f-1',
    ]);
  });
});

describe('describeTransaction', () => {
  it('claims success only for SUCCESS', () => {
    expect(describeTransaction(item({ status: 'SUCCESS' })).title).toBe('Funds added');
    expect(describeTransaction(item({ status: 'PENDING' })).title).toBe('Waiting for your payment');
    expect(describeTransaction(withdrawalItem({ status: 'PROCESSING' })).title).toBe(
      'Withdrawal in progress',
    );
    expect(describeTransaction(exchangeItem({ status: 'INITIATED' })).title).toBe(
      'Exchange in progress',
    );
    expect(describeTransaction(transferItem()).title).toBe('Transfer complete');
  });

  it('includes the backend failure reason', () => {
    const failed = describeTransaction(
      withdrawalItem({ status: 'FAILED', failureReason: 'Destination rejected.' }),
    );
    expect(failed.message).toBe(
      'Destination rejected. The held amount was returned to your available balance.',
    );
    expect(describeTransaction(exchangeItem({ status: 'FAILED' })).message).toBe(
      'Nothing was exchanged.',
    );
  });

  it("uses neutral copy for a status it doesn't know", () => {
    expect(describeTransaction(exchangeItem({ status: 'REVERSED' }))).toEqual({
      title: 'Exchange',
      message: 'Pull down to check for the latest status.',
    });
  });
});

describe('recordedSteps', () => {
  it('lists the ledger steps the backend recorded, per type', () => {
    expect(recordedSteps(item({ ledgerEntryIds: { credit: 'l', reversal: 'r' } }))).toEqual([
      'Added to your wallet',
      'Taken back out of your wallet',
    ]);
    expect(recordedSteps(withdrawalItem({ ledgerEntryIds: { hold: 'h', release: 'r' } }))).toEqual([
      'Held in your pending balance',
      'Returned to your available balance',
    ]);
    expect(recordedSteps(exchangeItem())).toEqual([
      'Taken from your CAD wallet',
      'Added to your NGN wallet',
    ]);
    expect(recordedSteps(item({ ledgerEntryIds: { unknown: 'x' } }))).toEqual([]);
  });
});

describe('transactionPollMs', () => {
  it('polls only while in progress, slower for an INITIATED money movement', () => {
    expect(transactionPollMs(undefined)).toBe(0);
    expect(transactionPollMs(item({ status: 'SUCCESS' }))).toBe(0);
    expect(transactionPollMs(item({ status: 'PENDING' }))).toBe(5_000);
    expect(transactionPollMs(withdrawalItem({ status: 'INITIATED' }))).toBe(30_000);
    expect(transactionPollMs(exchangeItem({ status: 'INITIATED' }))).toBe(5_000);
  });
});

describe('inProgressCount', () => {
  it('adds up the in-progress statuses across types', () => {
    expect(
      inProgressCount(
        summary({
          countByStatus: {
            'FUNDING:PENDING': 2,
            'WITHDRAWAL:INITIATED': 1,
            'EXCHANGE:SUCCESS': 4,
            'FUNDING:FAILED': 1,
          },
        }) as never,
      ),
    ).toBe(3);
  });
});
