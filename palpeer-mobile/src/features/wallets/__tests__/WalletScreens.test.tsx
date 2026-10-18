import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import type { RefreshControlProps } from 'react-native';

import { HomeScreen } from '@/features/home/HomeScreen';
import { sessionManager } from '@/services/auth/session';
import { secureStorage } from '@/services/storage/secureStorage';
import { fail, installFetchMock, ok } from '@/tests/fetchMock';
import { router, setSearchParams } from '@/tests/mocks/expoRouter';
import { renderWithProviders } from '@/tests/render';

import { CreateWalletScreen } from '../screens/CreateWalletScreen';
import { WalletDetailScreen } from '../screens/WalletDetailScreen';
import { WalletsScreen } from '../screens/WalletsScreen';
import { CURRENCIES, ledgerEntry, ledgerPage, rawOk, wallet } from './fixtures';

jest.mock('expo-router', () => require('../../../tests/mocks/expoRouter'));

type TreeNode = { props: Record<string, unknown>; children: (TreeNode | string)[] };

/** The first screen's pull-to-refresh handler, in render order. */
function findRefreshControl(node: TreeNode): RefreshControlProps | undefined {
  const control = node.props.refreshControl as { props: RefreshControlProps } | undefined;
  if (control) return control.props;
  for (const child of node.children) {
    if (typeof child === 'string') continue;
    const found = findRefreshControl(child);
    if (found) return found;
  }
  return undefined;
}

const KYC = {
  'GET /kyc/status': ok({
    caseId: null,
    userId: 'u-1',
    status: 'NOT_STARTED',
    rejectionReason: null,
    createdAt: null,
    updatedAt: null,
  }),
};

beforeEach(async () => {
  jest.clearAllMocks();
  await secureStorage.clearAll();
  await sessionManager.start(
    { userId: 'u-1', accessToken: 'access-0', refreshToken: 'refresh-0', tokenType: 'Bearer' },
    'ada@example.com',
  );
});

describe('WalletsScreen', () => {
  it('shows the empty state with the original copy', async () => {
    installFetchMock({ 'GET /wallets': ok([]), 'GET /currencies': CURRENCIES });
    await renderWithProviders(<WalletsScreen />);

    expect(await screen.findByText('No Wallets Available')).toBeTruthy();
    expect(screen.getByText('Create a new wallet to get started')).toBeTruthy();
    await fireEvent.press(screen.getByText('Create wallet'));
    expect(router.push).toHaveBeenCalledWith('/wallet/create');
  });

  it('shows balances exactly as the backend sent them, per currency', async () => {
    installFetchMock({
      'GET /wallets': rawOk(
        '[{"id":"w-cad","userId":"u-1","currencyCode":"CAD","availableBalance":98765432109876543.210000000000,"pendingBalance":25.500000000000},' +
          '{"id":"w-ngn","userId":"u-1","currencyCode":"NGN","availableBalance":1500.000000000000,"pendingBalance":0.000000000000}]',
      ),
      'GET /currencies': CURRENCIES,
    });
    await renderWithProviders(<WalletsScreen />);

    expect(await screen.findByTestId('wallet-available-CAD')).toHaveTextContent(
      '98,765,432,109,876,543.21 CAD',
    );
    expect(screen.getByTestId('wallet-pending-CAD')).toHaveTextContent('25.50 CAD pending');
    expect(screen.getByTestId('wallet-available-NGN')).toHaveTextContent('1,500.00 NGN');
    expect(screen.queryByTestId('wallet-pending-NGN')).toBeNull();
  });

  it('shows an error with retry when wallets cannot load', async () => {
    installFetchMock({
      'GET /wallets': [fail(500, 'INTERNAL_ERROR'), ok([])],
      'GET /currencies': CURRENCIES,
    });
    await renderWithProviders(<WalletsScreen />);

    await fireEvent.press(await screen.findByText('Try again'));
    expect(await screen.findByText('No Wallets Available')).toBeTruthy();
  });
});

describe('HomeScreen', () => {
  it('lists balances per currency without adding them up', async () => {
    installFetchMock({
      ...KYC,
      'GET /wallets': ok([wallet('w-cad', 'CAD', '10.00'), wallet('w-ngn', 'NGN', '20.00')]),
      'GET /currencies': CURRENCIES,
      'GET /notifications/unread-count': ok({ count: 0 }),
      'GET /promotions/active': ok([]),
      'GET /public/marketing-adverts': ok([]),
      'GET /transactions/recent': ok([]),
    });
    await renderWithProviders(<HomeScreen />);

    expect(await screen.findByTestId('wallet-available-CAD')).toHaveTextContent('CAD 10.00');
    expect(screen.getByTestId('wallet-available-NGN')).toHaveTextContent('NGN 20.00');
    expect(screen.queryByText(/30\.00/)).toBeNull();
  });

  it('hides balances on request and runs quick actions against the shown wallet', async () => {
    installFetchMock({
      ...KYC,
      'GET /wallets': ok([wallet('w-cad', 'CAD', '10.00'), wallet('w-ngn', 'NGN', '20.00')]),
      'GET /currencies': CURRENCIES,
      'GET /notifications/unread-count': ok({ count: 0 }),
      'GET /promotions/active': ok([]),
      'GET /public/marketing-adverts': ok([]),
      'GET /transactions/recent': ok([]),
    });
    await renderWithProviders(<HomeScreen />);

    await screen.findByTestId('wallet-available-CAD');
    await fireEvent.press(screen.getAllByTestId('balance-visibility')[0]!);
    expect(screen.getByTestId('wallet-available-CAD')).toHaveTextContent('CAD ••••••');
    expect(screen.queryByText(/10\.00/)).toBeNull();

    await fireEvent.press(screen.getByTestId('home-action-fund'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/wallet/[id]/fund',
      params: { id: 'w-cad' },
    });
    await fireEvent.press(screen.getByTestId('home-action-withdraw'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/wallet/[id]/withdraw',
      params: { id: 'w-cad' },
    });
    await fireEvent.press(screen.getByTestId('home-action-exchange'));
    expect(router.navigate).toHaveBeenCalledWith('/exchange');
    await fireEvent.press(screen.getByTestId('balance-open-NGN'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/wallet/[id]', params: { id: 'w-ngn' } });
  });

  it('sends quick money actions to wallet creation when there is no wallet', async () => {
    installFetchMock({
      ...KYC,
      'GET /wallets': ok([]),
      'GET /currencies': CURRENCIES,
      'GET /notifications/unread-count': ok({ count: 0 }),
      'GET /promotions/active': ok([]),
      'GET /public/marketing-adverts': ok([]),
      'GET /transactions/recent': ok([]),
    });
    await renderWithProviders(<HomeScreen />);

    expect(await screen.findByText('No Wallets Available')).toBeTruthy();
    expect(screen.getByText('Your transactions will show up here.')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('home-action-fund'));
    expect(router.push).toHaveBeenCalledWith('/wallet/create');
  });
});

describe('CreateWalletScreen', () => {
  it('offers only currencies the user does not hold, asks for PIN, then opens the new wallet', async () => {
    const { calls } = installFetchMock({
      'GET /currencies': CURRENCIES,
      'GET /wallets': ok([wallet('w-cad', 'CAD')]),
      'GET /security/pin': ok({ pinSet: true, lockedUntil: null }),
      'POST /security/pin/verify': { status: 200, body: undefined },
      'POST /wallets': {
        status: 201,
        body: { success: true, data: wallet('w-ngn', 'NGN'), timestamp: '' },
      },
    });
    await renderWithProviders(<CreateWalletScreen />);

    expect(await screen.findByTestId('create-wallet-option-NGN')).toBeTruthy();
    expect(screen.queryByTestId('create-wallet-option-CAD')).toBeNull();

    await fireEvent.press(screen.getByTestId('create-wallet-option-NGN'));
    await fireEvent.press(screen.getByTestId('create-wallet-submit'));

    for (const digit of '1234') {
      await fireEvent.press(await screen.findByTestId(`pin-prompt-entry-pad-key-${digit}`));
    }

    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith({
        pathname: '/wallet/[id]',
        params: { id: 'w-ngn' },
      }),
    );
    expect(calls.some((call) => call.method === 'POST' && call.path === '/security/pin/verify')).toBe(
      true,
    );
    expect(calls.find((call) => call.path === '/wallets' && call.method === 'POST')?.body).toEqual({
      currencyCode: 'NGN',
    });
  });

  it('explains a duplicate wallet after PIN confirmation', async () => {
    installFetchMock({
      'GET /currencies': CURRENCIES,
      'GET /wallets': ok([]),
      'GET /security/pin': ok({ pinSet: true, lockedUntil: null }),
      'POST /security/pin/verify': { status: 200, body: undefined },
      'POST /wallets': fail(409, 'WALLET_EXISTS'),
    });
    await renderWithProviders(<CreateWalletScreen />);

    await fireEvent.press(await screen.findByTestId('create-wallet-option-USD'));
    await fireEvent.press(screen.getByTestId('create-wallet-submit'));
    for (const digit of '1234') {
      await fireEvent.press(await screen.findByTestId(`pin-prompt-entry-pad-key-${digit}`));
    }

    expect(await screen.findByText('You already have a wallet in this currency.')).toBeTruthy();
  });
});

describe('WalletDetailScreen', () => {
  const recentItem = (id: string, walletId: string, type: string, status: string) => ({
    type,
    id,
    userId: 'u-1',
    status,
    walletId,
    secondaryWalletId: null,
    currencyCode: 'CAD',
    secondaryCurrencyCode: null,
    amount: '40.00',
    secondaryAmount: null,
    appliedRate: null,
    failureReason: null,
    ledgerEntryIds: {},
    createdAt: '2026-09-28T09:00:00Z',
    updatedAt: '2026-09-28T09:00:00Z',
  });

  it('shows backend balances, ledger entries and in-progress movements for this wallet', async () => {
    setSearchParams({ id: 'w-cad' });
    const { calls } = installFetchMock({
      'GET /wallets/w-cad': ok(wallet('w-cad', 'CAD', '1200.000000000000', '100.000000000000')),
      'GET /currencies': CURRENCIES,
      'GET /wallets/w-cad/transactions': [
        ledgerPage(
          [
            ledgerEntry('l-2', 'HOLD', '100.00', '1200.00', 'Withdrawal hold'),
            ledgerEntry('l-1', 'CREDIT', '1300.00', '1300.00', 'Funding credit'),
          ],
          { last: false },
        ),
        ledgerPage([ledgerEntry('l-0', 'DEBIT', '5.00', '0.00', 'Instant exchange debit')], {
          number: 1,
        }),
      ],
      'GET /notifications/unread-count': ok({ count: 0 }),
      'GET /promotions/active': ok([]),
      'GET /public/marketing-adverts': ok([]),
      'GET /transactions/recent': ok([
        recentItem('wd-1', 'w-cad', 'WITHDRAWAL', 'PENDING'),
        recentItem('f-9', 'w-cad', 'FUNDING', 'SUCCESS'),
        recentItem('f-8', 'w-other', 'FUNDING', 'PENDING'),
      ]),
    });
    await renderWithProviders(<WalletDetailScreen />);

    expect(await screen.findByTestId('wallet-available')).toHaveTextContent('1,200.00 CAD');
    expect(screen.getByTestId('wallet-pending')).toHaveTextContent('Pending 100.00 CAD');
    expect(await screen.findByTestId('ledger-amount-l-1')).toHaveTextContent('+1,300.00 CAD');
    expect(screen.getByTestId('ledger-amount-l-2')).toHaveTextContent('100.00 CAD');

    expect(await screen.findByTestId('movement-wd-1')).toBeTruthy();
    expect(screen.queryByTestId('movement-f-9')).toBeNull();
    expect(screen.queryByTestId('movement-f-8')).toBeNull();

    await fireEvent.press(screen.getByTestId('wallet-ledger-more'));
    expect(await screen.findByTestId('ledger-amount-l-0')).toHaveTextContent('−5.00 CAD');
    expect(
      calls.filter((call) => call.path === '/wallets/w-cad/transactions').map((c) => c.query),
    ).toEqual(['?page=0&size=20', '?page=1&size=20']);
  });

  it('pull to refresh also updates the cached wallet list', async () => {
    setSearchParams({ id: 'w-cad' });
    installFetchMock({
      'GET /wallets': [
        ok([wallet('w-cad', 'CAD', '0.00')]),
        ok([wallet('w-cad', 'CAD', '100.00')]),
      ],
      'GET /wallets/w-cad': [
        ok(wallet('w-cad', 'CAD', '0.00')),
        ok(wallet('w-cad', 'CAD', '100.00')),
      ],
      'GET /currencies': CURRENCIES,
      'GET /wallets/w-cad/transactions': ledgerPage([]),
      'GET /notifications/unread-count': ok({ count: 0 }),
      'GET /promotions/active': ok([]),
      'GET /public/marketing-adverts': ok([]),
      'GET /transactions/recent': ok([]),
    });
    await renderWithProviders(
      <>
        <WalletDetailScreen />
        <WalletsScreen />
      </>,
    );
    expect(await screen.findByTestId('wallet-available-CAD')).toHaveTextContent('0.00 CAD');

    const detailRefresh = findRefreshControl(screen.root as unknown as TreeNode);
    await act(async () => {
      detailRefresh?.onRefresh?.();
    });

    await waitFor(() =>
      expect(screen.getByTestId('wallet-available-CAD')).toHaveTextContent('100.00 CAD'),
    );
    expect(screen.getByTestId('wallet-available')).toHaveTextContent('100.00 CAD');
  });

  it('disables funding and withdrawal for a currency without a payment rail', async () => {
    setSearchParams({ id: 'w-usd' });
    installFetchMock({
      'GET /wallets/w-usd': ok(wallet('w-usd', 'USD', '10.00')),
      'GET /currencies': CURRENCIES,
      'GET /wallets/w-usd/transactions': ledgerPage([]),
      'GET /notifications/unread-count': ok({ count: 0 }),
      'GET /promotions/active': ok([]),
      'GET /public/marketing-adverts': ok([]),
      'GET /transactions/recent': ok([]),
    });
    await renderWithProviders(<WalletDetailScreen />);

    expect(await screen.findByTestId('wallet-no-rail')).toBeTruthy();
    expect(screen.getByTestId('wallet-fund').props.accessibilityState?.disabled).toBe(true);
    expect(screen.getByTestId('wallet-withdraw').props.accessibilityState?.disabled).toBe(true);
    expect(await screen.findByText('No transactions yet')).toBeTruthy();
  });
});
