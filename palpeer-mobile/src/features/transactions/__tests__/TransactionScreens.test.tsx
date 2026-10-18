import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { HomeScreen } from '@/features/home/HomeScreen';
import { sessionManager } from '@/services/auth/session';
import { secureStorage } from '@/services/storage/secureStorage';
import { fail, installFetchMock, ok, type RecordedCall } from '@/tests/fetchMock';
import { router, setSearchParams } from '@/tests/mocks/expoRouter';
import { renderWithProviders } from '@/tests/render';

import { CURRENCIES, rawOk } from '../../wallets/__tests__/fixtures';
import { ActivityScreen } from '../screens/ActivityScreen';
import { TransactionDetailScreen } from '../screens/TransactionDetailScreen';
import { exchangeItem, historyPage, item, summary, withdrawalItem } from './fixtures';

jest.mock('expo-router', () => require('../../../tests/mocks/expoRouter'));

const callsTo = (calls: RecordedCall[], method: string, path: string) =>
  calls.filter((call) => call.method === method && call.path === path);

const queryOf = (call: RecordedCall | undefined) => new URLSearchParams(call?.query ?? '');

const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });

beforeEach(async () => {
  jest.clearAllMocks();
  setSearchParams({});
  await secureStorage.clearAll();
  await sessionManager.start(
    { userId: 'u-1', accessToken: 'access-0', refreshToken: 'refresh-0', tokenType: 'Bearer' },
    'ada@example.com',
  );
});

describe('ActivityScreen', () => {
  it('lists funding, withdrawals and exchanges with their backend status and a summary', async () => {
    const { calls } = installFetchMock({
      'GET /currencies': CURRENCIES,
      'GET /transactions/history': ok(
        historyPage([
          exchangeItem({ createdAt: '2026-09-29T11:00:00Z' }),
          withdrawalItem({ createdAt: '2026-09-29T10:30:00Z' }),
          item({ createdAt: '2026-09-29T10:00:00Z' }),
        ]),
      ),
      'GET /transactions/summary': ok(summary()),
    });
    await renderWithProviders(<ActivityScreen />);

    expect(await screen.findByTestId('transaction-x-1')).toHaveTextContent(/Exchange CAD → NGN/);
    expect(screen.getByTestId('transaction-x-1-amount')).toHaveTextContent(
      '100.00 CAD → 108,945.12 NGN',
    );
    expect(screen.getByTestId('transaction-wd-1')).toHaveTextContent(/Withdrawal · CAD/);
    expect(screen.getByTestId('transaction-wd-1')).toHaveTextContent(/Pending/);
    expect(screen.getByTestId('transaction-f-1')).toHaveTextContent(/Success/);

    expect(await screen.findByTestId('activity-summary-total')).toHaveTextContent('3 transactions');
    expect(screen.getByTestId('activity-summary-in')).toHaveTextContent(/250\.00 CAD/);
    expect(screen.getByTestId('activity-summary-out')).toHaveTextContent(/None/);
    expect(screen.getByTestId('activity-summary-footer')).toHaveTextContent(
      '1 completed exchange · 1 in progress',
    );

    const history = queryOf(callsTo(calls, 'GET', '/transactions/history')[0]);
    expect(history.get('page')).toBe('0');
    expect(history.get('size')).toBe('20');
    expect(history.has('type')).toBe(false);
    expect(history.has('from')).toBe(false);
    // The summary defaults to 30 days, so "All time" asks from the epoch.
    expect(queryOf(callsTo(calls, 'GET', '/transactions/summary')[0]).get('from')).toBe(
      '1970-01-01T00:00:00Z',
    );

    await fireEvent.press(screen.getByTestId('transaction-wd-1'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/transaction/[type]/[id]',
      params: { type: 'WITHDRAWAL', id: 'wd-1' },
    });
  });

  it('keeps amounts exact and never adds totals in different currencies', async () => {
    installFetchMock({
      'GET /currencies': CURRENCIES,
      'GET /transactions/history': rawOk(
        '{"items":[{"type":"FUNDING","id":"f-9","userId":"u-1","status":"SUCCESS","walletId":"w-cad","secondaryWalletId":null,"currencyCode":"CAD","secondaryCurrencyCode":null,"amount":98765432109876543.210000000000,"secondaryAmount":null,"appliedRate":null,"failureReason":null,"ledgerEntryIds":{},"createdAt":"2026-09-29T10:00:00Z","updatedAt":"2026-09-29T10:00:00Z"}],"page":0,"size":20,"totalElements":1,"totalPages":1}',
      ),
      'GET /transactions/summary': rawOk(
        JSON.stringify(summary({ successfulFundingByCurrency: [] })).replace(
          '"successfulFundingByCurrency":[]',
          '"successfulFundingByCurrency":[{"currencyCode":"CAD","totalAmount":98765432109876543.21,"count":1},{"currencyCode":"NGN","totalAmount":1500.5,"count":2}]',
        ),
      ),
    });
    await renderWithProviders(<ActivityScreen />);

    expect(await screen.findByTestId('transaction-f-9-amount')).toHaveTextContent(
      '98,765,432,109,876,543.21 CAD',
    );
    const moneyIn = await screen.findByTestId('activity-summary-in');
    expect(moneyIn).toHaveTextContent(/98,765,432,109,876,543\.21 CAD/);
    expect(moneyIn).toHaveTextContent(/1,500\.50 NGN/);
  });

  it('filters by type and period through the backend query', async () => {
    const { calls } = installFetchMock({
      'GET /currencies': CURRENCIES,
      'GET /transactions/history': ok(historyPage([item()])),
      'GET /transactions/summary': ok(summary()),
    });
    await renderWithProviders(<ActivityScreen />);
    await screen.findByTestId('transaction-f-1');

    await fireEvent.press(screen.getByTestId('activity-filter-type'));
    await fireEvent.press(await screen.findByTestId('activity-type-picker-option-EXCHANGE'));
    await waitFor(() =>
      expect(queryOf(callsTo(calls, 'GET', '/transactions/history').at(-1)).get('type')).toBe(
        'EXCHANGE',
      ),
    );

    const before = Date.now();
    await fireEvent.press(screen.getByTestId('activity-filter-period'));
    await fireEvent.press(await screen.findByTestId('activity-period-picker-option-7D'));
    await waitFor(() =>
      expect(queryOf(callsTo(calls, 'GET', '/transactions/history').at(-1)).has('from')).toBe(true),
    );
    const last = queryOf(callsTo(calls, 'GET', '/transactions/history').at(-1));
    expect(last.get('type')).toBe('EXCHANGE');
    const from = Date.parse(last.get('from') ?? '');
    expect(before - from).toBeGreaterThanOrEqual(7 * 86_400_000 - 1000);
    expect(before - from).toBeLessThan(7 * 86_400_000 + 60_000);
    expect(queryOf(callsTo(calls, 'GET', '/transactions/summary').at(-1)).get('from')).toBe(
      last.get('from'),
    );
    await settle();
  });

  it('loads older pages and shows each transaction once', async () => {
    const { calls } = installFetchMock({
      'GET /currencies': CURRENCIES,
      'GET /transactions/history': [
        ok(historyPage([item({ id: 'f-2' }), item({ id: 'f-1' })], { page: 0, totalPages: 2 })),
        ok(historyPage([item({ id: 'f-1' }), item({ id: 'f-0' })], { page: 1, totalPages: 2 })),
      ],
      'GET /transactions/summary': ok(summary()),
    });
    await renderWithProviders(<ActivityScreen />);
    await screen.findByTestId('transaction-f-2');

    await fireEvent.press(screen.getByTestId('activity-more'));
    expect(await screen.findByTestId('transaction-f-0')).toBeTruthy();
    expect(screen.getAllByTestId('transaction-f-1')).toHaveLength(1);
    expect(screen.queryByTestId('activity-more')).toBeNull();
    expect(
      callsTo(calls, 'GET', '/transactions/history').map((call) => queryOf(call).get('page')),
    ).toEqual(['0', '1']);
  });

  it('explains an empty history, and offers to clear filters when they hide everything', async () => {
    installFetchMock({
      'GET /currencies': CURRENCIES,
      'GET /transactions/history': ok(historyPage([])),
      'GET /transactions/summary': ok(summary({ totalCount: 0, countByStatus: {} })),
    });
    await renderWithProviders(<ActivityScreen />);
    expect(await screen.findByText('No activity yet')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('activity-filter-type'));
    await fireEvent.press(await screen.findByTestId('activity-type-picker-option-FUNDING'));
    expect(await screen.findByTestId('activity-no-matches')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('activity-clear-filters'));
    expect(await screen.findByText('No activity yet')).toBeTruthy();
    await settle();
  });

  it('shows an error with retry when the history cannot load', async () => {
    installFetchMock({
      'GET /currencies': CURRENCIES,
      'GET /transactions/history': [fail(500, 'INTERNAL_ERROR'), ok(historyPage([item()]))],
      'GET /transactions/summary': ok(summary()),
    });
    await renderWithProviders(<ActivityScreen />);

    await fireEvent.press(await screen.findByText('Try again'));
    expect(await screen.findByTestId('transaction-f-1')).toBeTruthy();
  });
});

describe('Home recent activity', () => {
  it('shows the latest transactions and links to Activity', async () => {
    const { calls } = installFetchMock({
      'GET /currencies': CURRENCIES,
      'GET /wallets': ok([]),
      'GET /kyc/status': ok({
        caseId: null,
        userId: 'u-1',
        status: 'NOT_STARTED',
        rejectionReason: null,
        createdAt: null,
        updatedAt: null,
      }),
      'GET /notifications/unread-count': ok({ count: 0 }),
      'GET /promotions/active': ok([]),
      'GET /public/marketing-adverts': ok([]),
      'GET /transactions/recent': ok([exchangeItem(), item()]),
    });
    await renderWithProviders(<HomeScreen />);

    expect(await screen.findByTestId('home-activity')).toBeTruthy();
    expect(screen.getByTestId('transaction-x-1')).toBeTruthy();
    expect(queryOf(callsTo(calls, 'GET', '/transactions/recent')[0]).get('limit')).toBe('6');
    expect(screen.getByTestId('transaction-x-1-amount')).toHaveTextContent('CAD/NGN 100.00');
    await fireEvent.press(screen.getByText('see all'));
    expect(router.navigate).toHaveBeenCalledWith('/activity');
    await fireEvent.press(screen.getByTestId('transaction-f-1'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/transaction/[type]/[id]',
      params: { type: 'FUNDING', id: 'f-1' },
    });
  });
});

describe('TransactionDetailScreen', () => {
  it('shows a completed exchange with both amounts, the applied rate and its steps', async () => {
    setSearchParams({ type: 'EXCHANGE', id: 'x-1' });
    installFetchMock({
      'GET /currencies': CURRENCIES,
      'GET /transactions/EXCHANGE/x-1': ok(exchangeItem()),
    });
    await renderWithProviders(<TransactionDetailScreen />);

    expect(await screen.findByTestId('movement-title')).toHaveTextContent('Exchange complete');
    expect(screen.getByTestId('movement-amount')).toHaveTextContent('108,945.12 NGN');
    expect(screen.getByTestId('transaction-sent')).toHaveTextContent('100.00 CAD');
    expect(screen.getByTestId('transaction-received')).toHaveTextContent('108,945.12 NGN');
    expect(screen.getByTestId('transaction-rate')).toHaveTextContent('1 CAD = 1,089.4512 NGN');
    expect(screen.getByTestId('transaction-timeline')).toHaveTextContent(
      /Taken from your CAD wallet.*Added to your NGN wallet.*Success/,
    );
    expect(screen.queryByTestId('transaction-details-link')).toBeNull();
  });

  it('never says a pending withdrawal succeeded, and links to its payout details', async () => {
    setSearchParams({ type: 'WITHDRAWAL', id: 'wd-1' });
    installFetchMock({
      'GET /currencies': CURRENCIES,
      'GET /transactions/WITHDRAWAL/wd-1': ok(withdrawalItem()),
    });
    await renderWithProviders(<TransactionDetailScreen />);

    expect(await screen.findByTestId('movement-title')).toHaveTextContent('Withdrawal in progress');
    expect(screen.getByTestId('movement-status')).toHaveTextContent('Pending');
    expect(screen.getByTestId('transaction-timeline')).toHaveTextContent(
      /Held in your pending balance.*Waiting for the next update/,
    );
    expect(screen.queryByText('Withdrawal complete')).toBeNull();
    expect(screen.queryByText('Success')).toBeNull();

    await fireEvent.press(screen.getByTestId('transaction-details-link'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/wallet/withdrawal/[withdrawalId]',
      params: { withdrawalId: 'wd-1' },
    });
  });

  it('shows the failure reason from the backend', async () => {
    setSearchParams({ type: 'FUNDING', id: 'f-1' });
    installFetchMock({
      'GET /currencies': CURRENCIES,
      'GET /transactions/FUNDING/f-1': ok(
        item({ status: 'FAILED', failureReason: 'Payment declined', ledgerEntryIds: {} }),
      ),
    });
    await renderWithProviders(<TransactionDetailScreen />);

    expect(await screen.findByTestId('movement-title')).toHaveTextContent('Funding failed');
    expect(screen.getByTestId('movement-message')).toHaveTextContent(
      'Payment declined. Nothing was added to your wallet.',
    );
    expect(screen.getByTestId('transaction-reason')).toHaveTextContent('Payment declined');
    expect(screen.getByTestId('transaction-reference')).toHaveTextContent('f-1');
  });

  it('shows not found from the backend', async () => {
    setSearchParams({ type: 'FUNDING', id: 'nope' });
    installFetchMock({
      'GET /currencies': CURRENCIES,
      'GET /transactions/FUNDING/nope': fail(
        404,
        'RESOURCE_NOT_FOUND',
        'Funding transaction not found',
      ),
    });
    await renderWithProviders(<TransactionDetailScreen />);
    expect(await screen.findByText('Funding transaction not found')).toBeTruthy();
  });

  it("doesn't call the backend for a link with an unknown type", async () => {
    setSearchParams({ type: 'BONUS', id: 'b-1' });
    const { calls } = installFetchMock({ 'GET /currencies': CURRENCIES });
    await renderWithProviders(<TransactionDetailScreen />);
    expect(await screen.findByText('Transaction not found')).toBeTruthy();
    await settle();
    expect(calls.filter((call) => call.path.startsWith('/transactions'))).toHaveLength(0);
  });
});
