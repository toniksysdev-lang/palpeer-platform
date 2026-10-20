import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';

import { sessionManager } from '@/services/auth/session';
import { secureStorage } from '@/services/storage/secureStorage';
import type { AppStore } from '@/store';
import { sessionStarted } from '@/store/slices/sessionSlice';
import { fail, installFetchMock, ok, type RecordedCall } from '@/tests/fetchMock';
import { router, setSearchParams } from '@/tests/mocks/expoRouter';
import { typeIntoNumberField, typeOnNumberPad } from '@/tests/numberPad';import { renderWithProviders } from '@/tests/render';

import { CreateRequestScreen } from '../screens/CreateRequestScreen';
import { EditRequestScreen } from '../screens/EditRequestScreen';
import { MarketplaceScreen } from '../screens/MarketplaceScreen';
import { OrderDetailScreen } from '../screens/OrderDetailScreen';
import { P2PHistoryScreen } from '../screens/P2PHistoryScreen';
import { RequestDetailScreen } from '../screens/RequestDetailScreen';
import {
  created,
  CURRENCIES,
  ME,
  orderSummary,
  OTHER,
  p2pOrder,
  p2pRequest,
  WALLETS,
} from './fixtures';

jest.mock('expo-router', () => require('../../../tests/mocks/expoRouter'));

const signedIn = {
  prepareStore: (store: AppStore) =>
    void store.dispatch(sessionStarted({ userId: ME, email: null })),
};

const NO_NEGOTIATIONS = ok([]);

const callsTo = (calls: RecordedCall[], method: string, path: string) =>
  calls.filter((call) => call.method === method && call.path === path);

/** Create screen fetches pair bounds; default = no configured limits. */
const createRoutes = (routes: Parameters<typeof installFetchMock>[0]) =>
  installFetchMock({
    'GET /p2p/rate-bounds': ok(null),
    ...routes,
  });

beforeEach(async () => {
  jest.clearAllMocks();
  setSearchParams({});
  await secureStorage.clearAll();
  await sessionManager.start(
    { userId: ME, accessToken: 'access-0', refreshToken: 'refresh-0', tokenType: 'Bearer' },
    null,
  );
});

describe('MarketplaceScreen', () => {
  const LIST = ok([
    p2pRequest({ id: 'r-1', side: 'SELL', rate: '1500.000000000000' }),
    p2pRequest({
      id: 'r-2',
      userId: ME,
      side: 'BUY',
      baseCurrencyCode: 'CAD',
      quoteCurrencyCode: 'NGN',
      amount: '50.000000000000',
      rate: '950.500000000000',
    }),
  ]);

  it('lists open requests with backend amounts and rates, marking my own', async () => {
    installFetchMock({ 'GET /p2p/requests': LIST, 'GET /currencies': CURRENCIES });
    await renderWithProviders(<MarketplaceScreen />, signedIn);

    const theirs = await screen.findByTestId('p2p-request-r-1');
    expect(theirs).toHaveTextContent(/Wants to sell USD for NGN/);
    expect(theirs).toHaveTextContent(/100\.00 USD/);
    expect(theirs).toHaveTextContent(/1 USD = 1,500 NGN/);
    const mine = screen.getByTestId('p2p-request-r-2');
    expect(mine).toHaveTextContent(/You want to buy CAD for NGN/);
    expect(within(mine).getByText('Yours')).toBeTruthy();

    await fireEvent.press(theirs);
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/p2p/request/[id]',
      params: { id: 'r-1' },
    });
  });

  it('filters by side, currency and search on the device, and clears filters', async () => {
    installFetchMock({ 'GET /p2p/requests': LIST, 'GET /currencies': CURRENCIES });
    await renderWithProviders(<MarketplaceScreen />, signedIn);
    await screen.findByTestId('p2p-request-r-1');

    await fireEvent.press(screen.getByRole('radio', { name: 'Buy' }));
    expect(screen.queryByTestId('p2p-request-r-1')).toBeNull();
    expect(screen.getByTestId('p2p-result-count')).toHaveTextContent('1 of 2 requests');

    await fireEvent.press(screen.getByRole('radio', { name: 'All' }));
    await fireEvent.press(screen.getByTestId('p2p-filter-currency'));
    await fireEvent.press(await screen.findByTestId('p2p-currency-picker-option-USD'));
    expect(screen.getByTestId('p2p-request-r-1')).toBeTruthy();
    expect(screen.queryByTestId('p2p-request-r-2')).toBeNull();

    await fireEvent.changeText(screen.getByTestId('p2p-search'), 'ZZZNOMATCH');
    expect(await screen.findByTestId('p2p-no-matches')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('p2p-clear-filters'));
    expect(screen.getByTestId('p2p-request-r-1')).toBeTruthy();
    expect(screen.getByTestId('p2p-request-r-2')).toBeTruthy();
  });

  it('sorts by lowest rate', async () => {
    installFetchMock({ 'GET /p2p/requests': LIST, 'GET /currencies': CURRENCIES });
    await renderWithProviders(<MarketplaceScreen />, signedIn);
    await screen.findByTestId('p2p-request-r-1');

    await fireEvent.press(screen.getByTestId('p2p-filter-sort'));
    await fireEvent.press(await screen.findByTestId('p2p-sort-picker-option-RATE_ASC'));
    const order = screen
      .getAllByTestId(/^p2p-request-r-/)
      .map((node) => node.props.testID as string);
    expect(order).toEqual(['p2p-request-r-2', 'p2p-request-r-1']);
  });

  it('offers to create the first request when the marketplace is empty', async () => {
    installFetchMock({ 'GET /p2p/requests': ok([]), 'GET /currencies': CURRENCIES });
    await renderWithProviders(<MarketplaceScreen />, signedIn);

    expect(await screen.findByText('No open requests')).toBeTruthy();
    await fireEvent.press(screen.getByText('Create request'));
    expect(router.push).toHaveBeenCalledWith('/p2p/create');
  });

  it('shows the error with a retry when the list fails', async () => {
    installFetchMock({
      'GET /p2p/requests': [fail(500, 'INTERNAL_ERROR'), ok([p2pRequest()])],
      'GET /currencies': CURRENCIES,
    });
    await renderWithProviders(<MarketplaceScreen />, signedIn);

    await fireEvent.press(await screen.findByText('Try again'));
    expect(await screen.findByTestId('p2p-request-r-1')).toBeTruthy();
  });
});

describe('CreateRequestScreen', () => {
  it('posts exactly the create fields with exact decimals and opens the new request', async () => {
    const { calls } = createRoutes({
      'GET /currencies': CURRENCIES,
      'GET /wallets': WALLETS,
      'POST /p2p/requests': created(p2pRequest({ id: 'r-new', userId: ME })),
    });
    await renderWithProviders(<CreateRequestScreen />, signedIn);

    await fireEvent.press(await screen.findByTestId('p2p-create-base'));
    await fireEvent.press(await screen.findByTestId('p2p-currency-sheet-option-USD'));
    await fireEvent.press(screen.getByTestId('p2p-create-quote'));
    await fireEvent.press(await screen.findByTestId('p2p-currency-sheet-option-NGN'));
    await fireEvent.press(screen.getByTestId('p2p-create-expiry'));
    await fireEvent.press(await screen.findByTestId('p2p-expiry-sheet-option-NONE'));
    await typeIntoNumberField('p2p-create-rate', '1500.123456');
    await typeIntoNumberField('p2p-create-amount', '100.25');
    await typeIntoNumberField('p2p-create-min-order', '10');
    await fireEvent.press(screen.getByTestId('p2p-create-submit'));
    expect(await screen.findByTestId('p2p-create-review')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('p2p-create-confirm'));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/(tabs)/p2p'));
    const [post] = callsTo(calls, 'POST', '/p2p/requests');
    // Amount must stay within wallet balance; rate keeps up to 12 decimals; no expiry/notes.
    expect(post?.rawBody).toBe(
      '{"side":"SELL","baseCurrencyCode":"USD","quoteCurrencyCode":"NGN","amount":100.25,"rate":1500.123456}',
    );
  });

  it('sends a chosen expiry and trimmed notes', async () => {
    const { calls } = createRoutes({
      'GET /currencies': CURRENCIES,
      'GET /wallets': WALLETS,
      'POST /p2p/requests': created(p2pRequest({ id: 'r-new', userId: ME })),
    });
    await renderWithProviders(<CreateRequestScreen />, signedIn);

    await typeIntoNumberField('p2p-create-amount', '10');
    await typeIntoNumberField('p2p-create-rate', '1500');
    await typeIntoNumberField('p2p-create-min-order', '5');
    await fireEvent.press(screen.getByTestId('p2p-create-expiry'));
    await fireEvent.press(await screen.findByTestId('p2p-expiry-sheet-option-24H'));
    await fireEvent.changeText(screen.getByTestId('p2p-create-notes'), 'Bank transfer');
    const before = Date.now();
    await fireEvent.press(screen.getByTestId('p2p-create-submit'));
    await fireEvent.press(await screen.findByTestId('p2p-create-confirm'));

    await waitFor(() => expect(callsTo(calls, 'POST', '/p2p/requests')).toHaveLength(1));
    const body = callsTo(calls, 'POST', '/p2p/requests')[0]?.body as Record<string, unknown>;
    expect(body.notes).toBe('Bank transfer');
    const expiresIn = Date.parse(body.expiresAt as string) - before;
    expect(expiresIn).toBeGreaterThan(24 * 3600_000 - 5_000);
    expect(expiresIn).toBeLessThanOrEqual(24 * 3600_000 + 5_000);
  });

  it('swaps the pair instead of allowing the same currency on both sides', async () => {
    createRoutes({ 'GET /currencies': CURRENCIES, 'GET /wallets': WALLETS });
    await renderWithProviders(<CreateRequestScreen />, signedIn);

    expect(await screen.findByTestId('p2p-create-base')).toHaveTextContent(/CAD/);
    expect(screen.getByTestId('p2p-create-quote')).toHaveTextContent(/NGN/);
    await fireEvent.press(screen.getByTestId('p2p-create-quote'));
    await fireEvent.press(await screen.findByTestId('p2p-currency-sheet-option-CAD'));
    expect(screen.getByTestId('p2p-create-base')).toHaveTextContent(/NGN/);
    expect(screen.getByTestId('p2p-create-quote')).toHaveTextContent(/CAD/);
  });

  it('posts NGN/CAD when selling NGN for CAD using sell-anchored rate', async () => {
    const { calls } = createRoutes({
      'GET /currencies': CURRENCIES,
      'GET /wallets': WALLETS,
      'POST /p2p/requests': created(
        p2pRequest({
          id: 'r-ngn-cad',
          userId: ME,
          baseCurrencyCode: 'NGN',
          quoteCurrencyCode: 'CAD',
        }),
      ),
    });
    await renderWithProviders(<CreateRequestScreen />, signedIn);

    await fireEvent.press(await screen.findByTestId('p2p-create-quote'));
    await fireEvent.press(await screen.findByTestId('p2p-currency-sheet-option-CAD'));
    // Rate unit follows the sell currency so You receive = amount × rate.
    expect(screen.getByTestId('p2p-create-rate-unit')).toHaveTextContent(/NGN/);
    expect(screen.getByTestId('p2p-create-rate-hint')).toHaveTextContent(
      /Enter CAD per 1 NGN\. NGN stays fixed at 1/,
    );
    // Enter rate first (CAD per NGN), then amount — avoids pad focus races.
    await typeIntoNumberField('p2p-create-rate', '0.001');
    await typeIntoNumberField('p2p-create-amount', '100000');
    await typeIntoNumberField('p2p-create-min-order', '1000');
    expect(await screen.findByTestId('p2p-create-receive-amount')).toHaveTextContent(/100\.00 CAD/);
    expect(screen.getByTestId('p2p-create-receive-equation')).toHaveTextContent(
      /100,000 NGN × 0\.001 = 100 CAD/,
    );
    await fireEvent.press(screen.getByTestId('p2p-create-submit'));
    await fireEvent.press(await screen.findByTestId('p2p-create-confirm'));

    await waitFor(() => expect(callsTo(calls, 'POST', '/p2p/requests')).toHaveLength(1));
    const body = callsTo(calls, 'POST', '/p2p/requests')[0]?.body as Record<string, unknown>;
    expect(body.side).toBe('SELL');
    expect(body.baseCurrencyCode).toBe('NGN');
    expect(body.quoteCurrencyCode).toBe('CAD');
    expect(body.amount).toBe(100000);
    expect(Number(body.rate)).toBeCloseTo(0.001);
  });

  it('lets the rate unit dropdown flip without corrupting the typed CAD rate', async () => {
    const { calls } = createRoutes({
      'GET /currencies': CURRENCIES,
      'GET /wallets': WALLETS,
      'POST /p2p/requests': created(
        p2pRequest({
          id: 'r-ngn-cad-flip',
          userId: ME,
          baseCurrencyCode: 'NGN',
          quoteCurrencyCode: 'CAD',
        }),
      ),
    });
    await renderWithProviders(<CreateRequestScreen />, signedIn);

    await fireEvent.press(await screen.findByTestId('p2p-create-quote'));
    await fireEvent.press(await screen.findByTestId('p2p-currency-sheet-option-CAD'));
    // Switch to CAD-anchored entry and type 980 NGN per 1 CAD
    await fireEvent.press(screen.getByTestId('p2p-create-rate-unit'));
    await fireEvent.press(await screen.findByTestId('p2p-rate-unit-sheet-option-CAD'));
    await typeIntoNumberField('p2p-create-rate', '980');
    expect(screen.getByTestId('p2p-create-rate')).toHaveTextContent(/980/);

    // Flip to NGN — shows 1/980 (12 dp)
    await fireEvent.press(screen.getByTestId('p2p-create-rate-unit'));
    await fireEvent.press(await screen.findByTestId('p2p-rate-unit-sheet-option-NGN'));
    expect(screen.getByTestId('p2p-create-rate-unit')).toHaveTextContent(/NGN/);
    expect(screen.getByTestId('p2p-create-rate')).toHaveTextContent(/0\.001020408163/);

    // Flip back — exact typed value restored (not 980.0000002548)
    await fireEvent.press(screen.getByTestId('p2p-create-rate-unit'));
    await fireEvent.press(await screen.findByTestId('p2p-rate-unit-sheet-option-CAD'));
    expect(screen.getByTestId('p2p-create-rate-unit')).toHaveTextContent(/CAD/);
    expect(screen.getByTestId('p2p-create-rate')).toHaveTextContent(/980/);
    expect(screen.getByTestId('p2p-create-rate')).not.toHaveTextContent(/980\.000/);

    await typeIntoNumberField('p2p-create-amount', '98000');
    await typeIntoNumberField('p2p-create-min-order', '980');
    expect(await screen.findByTestId('p2p-create-receive-amount')).toHaveTextContent(/100\.00 CAD/);
    await fireEvent.press(screen.getByTestId('p2p-create-submit'));
    await fireEvent.press(await screen.findByTestId('p2p-create-confirm'));

    await waitFor(() => expect(callsTo(calls, 'POST', '/p2p/requests')).toHaveLength(1));
    const body = callsTo(calls, 'POST', '/p2p/requests')[0]?.body as Record<string, unknown>;
    expect(body.baseCurrencyCode).toBe('NGN');
    expect(body.quoteCurrencyCode).toBe('CAD');
    expect(Number(body.rate)).toBeCloseTo(1 / 980);
  });

  it('keeps Review request disabled until amount, rate, and minimum order are valid', async () => {
    const { calls } = createRoutes({
      'GET /currencies': CURRENCIES,
      'GET /wallets': WALLETS,
    });
    await renderWithProviders(<CreateRequestScreen />, signedIn);

    const submit = await screen.findByTestId('p2p-create-submit');
    expect(submit.props.accessibilityState?.disabled).toBe(true);

    await typeIntoNumberField('p2p-create-amount', '10');
    expect(submit.props.accessibilityState?.disabled).toBe(true);

    await typeIntoNumberField('p2p-create-rate', '1500');
    // Minimum order is required — still disabled while empty.
    expect(screen.getByTestId('p2p-create-submit').props.accessibilityState?.disabled).toBe(true);

    await typeIntoNumberField('p2p-create-min-order', '5');
    expect(screen.getByTestId('p2p-create-submit').props.accessibilityState?.disabled).toBe(false);
    expect(callsTo(calls, 'POST', '/p2p/requests')).toHaveLength(0);
  });

  it('blocks selling more than the wallet available balance', async () => {
    const { calls } = createRoutes({
      'GET /currencies': CURRENCIES,
      'GET /wallets': WALLETS,
    });
    await renderWithProviders(<CreateRequestScreen />, signedIn);

    await typeIntoNumberField('p2p-create-rate', '1500');
    await typeIntoNumberField('p2p-create-amount', '1000.01');
    expect(
      await screen.findByText(/Amount cannot exceed your CAD wallet balance/),
    ).toBeTruthy();
    await fireEvent.press(screen.getByTestId('p2p-create-submit'));
    expect(screen.queryByTestId('p2p-create-review')).toBeNull();
    expect(callsTo(calls, 'POST', '/p2p/requests')).toHaveLength(0);
  });

  it('shows configured rate bounds and flips them with the rate unit', async () => {
    installFetchMock({
      'GET /currencies': CURRENCIES,
      'GET /wallets': WALLETS,
      'GET /p2p/rate-bounds': ({ query }) => {
        if (query.includes('baseCurrencyCode=NGN') && query.includes('quoteCurrencyCode=CAD')) {
          return ok({
            id: 'b-1',
            baseCurrencyCode: 'NGN',
            quoteCurrencyCode: 'CAD',
            minRate: '0.001020408163',
            maxRate: '0.001052631579',
          });
        }
        return ok(null);
      },
    });
    await renderWithProviders(<CreateRequestScreen />, signedIn);

    await fireEvent.press(await screen.findByTestId('p2p-create-quote'));
    await fireEvent.press(await screen.findByTestId('p2p-currency-sheet-option-CAD'));
    // Default unit = sell NGN → quote-per-base bounds
    expect(await screen.findByTestId('p2p-create-rate-bounds')).toHaveTextContent(
      /Rate must be between 0\.001020408163 and 0\.001052631579 for NGN\/CAD/,
    );

    await fireEvent.press(screen.getByTestId('p2p-create-rate-unit'));
    await fireEvent.press(await screen.findByTestId('p2p-rate-unit-sheet-option-CAD'));
    // Switched unit = CAD → clean integers (same as admin Rate Switch)
    expect(screen.getByTestId('p2p-create-rate-bounds')).toHaveTextContent(
      'Rate must be between 950 and 980 for NGN/CAD',
    );
  });

  it('shows backend validation errors', async () => {
    createRoutes({
      'GET /currencies': CURRENCIES,
      'GET /wallets': WALLETS,
      'POST /p2p/requests': fail(400, 'P2P_EXPIRES_INVALID', 'expiresAt must be in the future'),
    });
    await renderWithProviders(<CreateRequestScreen />, signedIn);

    await typeIntoNumberField('p2p-create-amount', '10');
    await typeIntoNumberField('p2p-create-rate', '1500');
    await typeIntoNumberField('p2p-create-min-order', '5');
    await fireEvent.press(screen.getByTestId('p2p-create-submit'));
    await fireEvent.press(await screen.findByTestId('p2p-create-confirm'));

    expect(await screen.findByTestId('p2p-create-error')).toHaveTextContent(
      'The expiry time has already passed. Choose a later time.',
    );
    expect(router.replace).not.toHaveBeenCalled();
  });
});

describe('RequestDetailScreen — state transitions', () => {
  it('OPEN → ACCEPTED: a non-owner accepts and lands on the new order', async () => {
    setSearchParams({ id: 'r-1' });
    const { calls } = installFetchMock({
      'GET /currencies': CURRENCIES,
      'GET /negotiations/me': NO_NEGOTIATIONS,
      'GET /p2p/requests/r-1': ok(p2pRequest()),
      'POST /p2p/requests/r-1/accept': created(p2pOrder({ id: 'o-9' })),
    });
    await renderWithProviders(<RequestDetailScreen />, signedIn);

    expect(await screen.findByTestId('p2p-request-status')).toHaveTextContent('Open');
    expect(screen.queryByTestId('p2p-edit')).toBeNull();
    expect(screen.queryByTestId('p2p-cancel')).toBeNull();
    expect(screen.getByTestId('p2p-no-settlement')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('p2p-accept'));
    expect(await screen.findByText('Accept this request?')).toBeTruthy();
    expect(
      screen.getByText(
        'You agree to buy 100.00 USD at rate of 1 USD = 1,500 NGN. This creates an order between you and the Ada Lovelace who posted it. 150,000.00 NGN will be deducted from your NGN wallet.',
      ),
    ).toBeTruthy();
    await fireEvent.press(screen.getByTestId('confirm-dialog-confirm'));

    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith({
        pathname: '/p2p/order/[id]',
        params: { id: 'o-9' },
      }),
    );
    expect(callsTo(calls, 'POST', '/p2p/requests/r-1/accept')).toHaveLength(1);
  });

  it('409 P2P_NOT_OPEN: someone else got there first, so the refreshed status replaces Accept', async () => {
    setSearchParams({ id: 'r-1' });
    let status = 'OPEN';
    installFetchMock({
      'GET /currencies': CURRENCIES,
      'GET /negotiations/me': NO_NEGOTIATIONS,
      'GET /p2p/requests/r-1': () => ok(p2pRequest({ status })),
      'POST /p2p/requests/r-1/accept': () => {
        status = 'ACCEPTED';
        return fail(409, 'P2P_NOT_OPEN', 'Request is not open: ACCEPTED');
      },
      // Someone else's order: not in mine, so no "View order".
      'GET /p2p/me/orders': ok([]),
    });
    await renderWithProviders(<RequestDetailScreen />, signedIn);

    await fireEvent.press(await screen.findByTestId('p2p-accept'));
    await fireEvent.press(await screen.findByTestId('confirm-dialog-confirm'));

    expect(await screen.findByTestId('p2p-action-error')).toHaveTextContent(
      'This request is no longer open.',
    );
    await waitFor(() =>
      expect(screen.getByTestId('p2p-request-status')).toHaveTextContent('Accepted'),
    );
    expect(screen.queryByTestId('p2p-accept')).toBeNull();
    expect(screen.queryByTestId('p2p-view-order')).toBeNull();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('409 P2P_SELF_ACCEPT is explained if it ever reaches the backend', async () => {
    setSearchParams({ id: 'r-1' });
    installFetchMock({
      'GET /currencies': CURRENCIES,
      'GET /negotiations/me': NO_NEGOTIATIONS,
      'GET /p2p/requests/r-1': ok(p2pRequest()),
      'POST /p2p/requests/r-1/accept': fail(409, 'P2P_SELF_ACCEPT'),
    });
    await renderWithProviders(<RequestDetailScreen />, signedIn);

    await fireEvent.press(await screen.findByTestId('p2p-accept'));
    await fireEvent.press(await screen.findByTestId('confirm-dialog-confirm'));
    expect(await screen.findByTestId('p2p-action-error')).toHaveTextContent(
      "You can't accept your own request.",
    );
  });

  it('OPEN → CANCELLED: the owner cancels, and edit/cancel disappear', async () => {
    setSearchParams({ id: 'r-1' });
    let status = 'OPEN';
    const { calls } = installFetchMock({
      'GET /currencies': CURRENCIES,
      'GET /negotiations/me': NO_NEGOTIATIONS,
      'GET /p2p/requests/r-1': () => ok(p2pRequest({ userId: ME, status })),
      'DELETE /p2p/requests/r-1': () => {
        status = 'CANCELLED';
        return ok(null, 'P2P request cancelled');
      },
    });
    await renderWithProviders(<RequestDetailScreen />, signedIn);

    expect(await screen.findByTestId('p2p-request-side')).toHaveTextContent(
      'You want to sell USD for NGN',
    );
    expect(screen.queryByTestId('p2p-accept')).toBeNull();
    await fireEvent.press(screen.getByTestId('p2p-edit'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/p2p/request/[id]/edit',
      params: { id: 'r-1' },
    });

    await fireEvent.press(screen.getByTestId('p2p-cancel'));
    await fireEvent.press(await screen.findByTestId('confirm-dialog-confirm'));

    expect(await screen.findByTestId('p2p-cancelled')).toHaveTextContent(
      /Your request was cancelled/,
    );
    await waitFor(() =>
      expect(screen.getByTestId('p2p-request-status')).toHaveTextContent('Cancelled'),
    );
    expect(screen.queryByTestId('p2p-cancel')).toBeNull();
    expect(screen.queryByTestId('p2p-edit')).toBeNull();
    expect(callsTo(calls, 'DELETE', '/p2p/requests/r-1')).toHaveLength(1);
  });

  it('OPEN → EXPIRED: past its expiry the request is read as expired and cannot be accepted', async () => {
    setSearchParams({ id: 'r-1' });
    installFetchMock({
      'GET /currencies': CURRENCIES,
      'GET /negotiations/me': NO_NEGOTIATIONS,
      'GET /p2p/requests/r-1': ok(p2pRequest({ expiresAt: '2020-01-01T00:00:00Z' })),
    });
    await renderWithProviders(<RequestDetailScreen />, signedIn);

    expect(await screen.findByTestId('p2p-request-status')).toHaveTextContent('Expired');
    expect(screen.queryByTestId('p2p-accept')).toBeNull();
    expect(screen.getByTestId('p2p-not-open')).toBeTruthy();
  });

  it('ACCEPTED (mine): links to the order found in my orders', async () => {
    setSearchParams({ id: 'r-1' });
    installFetchMock({
      'GET /currencies': CURRENCIES,
      'GET /negotiations/me': NO_NEGOTIATIONS,
      'GET /p2p/requests/r-1': ok(p2pRequest({ userId: ME, status: 'ACCEPTED' })),
      'GET /p2p/me/orders': ok([
        orderSummary({ id: 'o-other', requestId: 'r-9' }),
        orderSummary({ id: 'o-7', requesterId: ME, acceptorId: OTHER }),
      ]),
    });
    await renderWithProviders(<RequestDetailScreen />, signedIn);

    await fireEvent.press(await screen.findByTestId('p2p-view-order'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/p2p/order/[id]',
      params: { id: 'o-7' },
    });
  });
});

describe('EditRequestScreen', () => {
  it('sends only the changed fields and goes back', async () => {
    setSearchParams({ id: 'r-1' });
    const { calls } = installFetchMock({
      'GET /currencies': CURRENCIES,
      'GET /negotiations/me': NO_NEGOTIATIONS,
      'GET /p2p/requests/r-1': ok(p2pRequest({ userId: ME, notes: 'Cash only' })),
      'PUT /p2p/requests/r-1': ok(p2pRequest({ userId: ME, rate: '1510.25' })),
    });
    await renderWithProviders(<EditRequestScreen />, signedIn);

    const rate = await screen.findByTestId('p2p-edit-rate');
    expect(rate).toHaveTextContent(/1[,.]?500/);
    expect(screen.getByTestId('p2p-edit-submit').props.accessibilityState?.disabled).toBe(true);
    await fireEvent.press(rate);
    for (let i = 0; i < 20; i += 1) {
      await fireEvent.press(screen.getByTestId('number-pad-dock-key-back'));
    }
    // Re-focus after clear so the pad value is the empty field (avoids appending to a stale pad value).
    await typeIntoNumberField('p2p-edit-rate', '1510.25');
    expect(screen.getByTestId('p2p-edit-rate')).toHaveTextContent(/1[,.]?510\.25/);
    await fireEvent.changeText(screen.getByTestId('p2p-edit-notes'), '');
    await fireEvent.press(screen.getByTestId('p2p-edit-submit'));

    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect(callsTo(calls, 'PUT', '/p2p/requests/r-1')[0]?.rawBody).toBe(
      '{"notes":"","rate":1510.25}',
    );
  });

  it('explains a 409 when the request stopped being open', async () => {
    setSearchParams({ id: 'r-1' });
    installFetchMock({
      'GET /currencies': CURRENCIES,
      'GET /negotiations/me': NO_NEGOTIATIONS,
      'GET /p2p/requests/r-1': ok(p2pRequest({ userId: ME })),
      'PUT /p2p/requests/r-1': fail(409, 'P2P_NOT_OPEN'),
    });
    await renderWithProviders(<EditRequestScreen />, signedIn);

    await fireEvent.press(await screen.findByTestId('p2p-edit-amount'));
    for (let i = 0; i < 20; i += 1) {
      await fireEvent.press(screen.getByTestId('number-pad-dock-key-back'));
    }
    await typeIntoNumberField('p2p-edit-amount', '90');
    await fireEvent.press(screen.getByTestId('p2p-edit-submit'));
    expect(await screen.findByTestId('p2p-edit-error')).toHaveTextContent(
      'This request is no longer open.',
    );
    expect(router.back).not.toHaveBeenCalled();
  });

  it("doesn't offer editing for someone else's or a closed request", async () => {
    setSearchParams({ id: 'r-1' });
    installFetchMock({
      'GET /currencies': CURRENCIES,
      'GET /negotiations/me': NO_NEGOTIATIONS,
      'GET /p2p/requests/r-1': ok(p2pRequest({ userId: ME, status: 'ACCEPTED' })),
    });
    await renderWithProviders(<EditRequestScreen />, signedIn);
    expect(await screen.findByTestId('p2p-edit-locked')).toBeTruthy();
  });
});

describe('P2PHistoryScreen', () => {
  it('shows my requests in every status and my orders with my role', async () => {
    installFetchMock({
      'GET /currencies': CURRENCIES,
      'GET /negotiations/me': NO_NEGOTIATIONS,
      'GET /p2p/me/requests': ok([
        p2pRequest({ id: 'r-a', userId: ME, status: 'OPEN' }),
        p2pRequest({ id: 'r-b', userId: ME, status: 'ACCEPTED' }),
        p2pRequest({ id: 'r-c', userId: ME, status: 'CANCELLED' }),
        p2pRequest({ id: 'r-d', userId: ME, status: 'OPEN', expiresAt: '2020-01-01T00:00:00Z' }),
      ]),
      'GET /p2p/me/orders': ok([
        orderSummary({ id: 'o-1' }),
        orderSummary({ id: 'o-2', requestId: 'r-b', requesterId: ME, acceptorId: OTHER }),
      ]),
    });
    await renderWithProviders(<P2PHistoryScreen />, signedIn);

    expect(await screen.findByTestId('p2p-request-r-a')).toHaveTextContent(/Open/);
    expect(screen.getByTestId('p2p-request-r-b')).toHaveTextContent(/Accepted/);
    expect(screen.getByTestId('p2p-request-r-c')).toHaveTextContent(/Cancelled/);
    expect(screen.getByTestId('p2p-request-r-d')).toHaveTextContent(/Expired/);

    await fireEvent.press(screen.getByRole('radio', { name: 'Orders' }));
    expect(await screen.findByTestId('p2p-order-o-1')).toHaveTextContent(/You accepted/);
    expect(screen.getByTestId('p2p-order-o-2')).toHaveTextContent(/Your request was accepted/);
    expect(screen.getByTestId('p2p-order-o-2')).toHaveTextContent(/1 USD = 1,500 NGN/);

    await fireEvent.press(screen.getByTestId('p2p-order-o-2'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/p2p/order/[id]',
      params: { id: 'o-2' },
    });
  });

  it('explains empty lists', async () => {
    installFetchMock({
      'GET /currencies': CURRENCIES,
      'GET /negotiations/me': NO_NEGOTIATIONS,
      'GET /p2p/me/requests': ok([]),
      'GET /p2p/me/orders': ok([]),
    });
    setSearchParams({ tab: 'orders' });
    await renderWithProviders(<P2PHistoryScreen />, signedIn);
    expect(await screen.findByText('No orders yet')).toBeTruthy();
  });
});

describe('OrderDetailScreen', () => {
  it('shows the order with the pair from its request and the no-settlement notice', async () => {
    setSearchParams({ id: 'o-1' });
    installFetchMock({
      'GET /currencies': CURRENCIES,
      'GET /p2p/orders/o-1': ok(p2pOrder()),
      'GET /p2p/requests/r-1': ok(p2pRequest({ status: 'ACCEPTED' })),
      'POST /chat/rooms': created({
        id: 'room-1',
        p2pOrderId: 'o-1',
        participantAId: OTHER,
        participantBId: ME,
        createdAt: '2026-09-28T12:00:00Z',
      }),
    });
    await renderWithProviders(<OrderDetailScreen />, signedIn);

    expect(await screen.findByTestId('p2p-order-status')).toHaveTextContent('Accepted');
    expect(screen.getByTestId('p2p-order-role')).toHaveTextContent('You accepted this request');
    expect(screen.getByTestId('p2p-order-amount')).toHaveTextContent('100.00 USD');
    expect(screen.getByTestId('p2p-order-rate')).toHaveTextContent(/1 USD = 1,500 NGN/);
    expect(screen.getByTestId('p2p-order-message')).toHaveTextContent(
      /Wallet settlement should complete momentarily/,
    );
    expect(screen.getByTestId('p2p-no-settlement')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('p2p-order-request'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/p2p/request/[id]',
      params: { id: 'r-1' },
    });

    // Opening the chat creates the room on first use (the backend returns an existing one after).
    await fireEvent.press(screen.getByTestId('p2p-order-chat'));
    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith({
        pathname: '/chat/[roomId]',
        params: { roomId: 'room-1' },
      }),
    );
  });

  it('explains when the chat cannot be opened', async () => {
    setSearchParams({ id: 'o-1' });
    installFetchMock({
      'GET /currencies': CURRENCIES,
      'GET /p2p/orders/o-1': ok(p2pOrder()),
      'GET /p2p/requests/r-1': ok(p2pRequest({ status: 'ACCEPTED' })),
      'POST /chat/rooms': fail(403, 'CHAT_NOT_PARTICIPANT', 'Not a participant of this order'),
    });
    await renderWithProviders(<OrderDetailScreen />, signedIn);
    await fireEvent.press(await screen.findByTestId('p2p-order-chat'));
    expect(await screen.findByTestId('p2p-order-chat-error')).toHaveTextContent(
      'Not a participant of this order',
    );
  });

  it('reflects an admin-completed order and disables messaging', async () => {
    setSearchParams({ id: 'o-1' });
    installFetchMock({
      'GET /currencies': CURRENCIES,
      'GET /p2p/orders/o-1': ok(
        p2pOrder({ status: 'COMPLETED', requesterId: ME, acceptorId: OTHER }),
      ),
      'GET /p2p/requests/r-1': ok(p2pRequest({ status: 'COMPLETED', userId: ME })),
    });
    await renderWithProviders(<OrderDetailScreen />, signedIn);

    expect(await screen.findByTestId('p2p-order-status')).toHaveTextContent('Completed');
    expect(screen.getByTestId('p2p-order-role')).toHaveTextContent('Your request was accepted');
    expect(screen.getByTestId('p2p-order-message')).toHaveTextContent(
      /Trade settled/,
    );
    expect(screen.getByTestId('p2p-order-chat').props.accessibilityState?.disabled).toBe(true);
    expect(screen.getByTestId('p2p-order-chat-closed')).toHaveTextContent(
      'Messaging is closed for completed orders.',
    );
  });

  it('shows not found for non-participants (backend 404)', async () => {
    setSearchParams({ id: 'o-1' });
    installFetchMock({
      'GET /currencies': CURRENCIES,
      'GET /p2p/orders/o-1': fail(404, 'RESOURCE_NOT_FOUND', 'P2P order not found'),
    });
    await renderWithProviders(<OrderDetailScreen />, signedIn);
    expect(await screen.findByText('P2P order not found')).toBeTruthy();
  });
});
