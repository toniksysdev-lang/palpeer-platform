import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { enterPin, PIN_STATUS } from '@/features/security/__tests__/helpers';
import { sessionManager } from '@/services/auth/session';
import { EXCHANGE_QUOTE_CACHE_KEY, exchangeApi } from '@/services/api/exchangeApi';
import { secureStorage } from '@/services/storage/secureStorage';
import type { AppStore } from '@/store';
import { fail, installFetchMock, ok, type RecordedCall } from '@/tests/fetchMock';
import { router, setSearchParams } from '@/tests/mocks/expoRouter';
import { preventScreenCaptureAsync } from '@/tests/mocks/media';
import { typeIntoNumberField } from '@/tests/numberPad';
import { renderWithProviders } from '@/tests/render';
import { toMoney } from '@/utils/money';

import { ExchangeResultScreen } from '../screens/ExchangeResultScreen';
import { ExchangeReviewScreen } from '../screens/ExchangeReviewScreen';
import { ExchangeScreen } from '../screens/ExchangeScreen';
import { RatesScreen } from '../screens/RatesScreen';
import { calculation, created, CURRENCIES, exchange, quote, wallet, WALLETS } from './fixtures';

jest.mock('expo-router', () => require('../../../tests/mocks/expoRouter'));

const posts = (calls: RecordedCall[], path: string) =>
  calls.filter((call) => call.method === 'POST' && call.path === path);

/** Starts a preview the way the exchange form does, so the review screen has a quote to show. */
function withQuote(store: AppStore) {
  void store.dispatch(
    exchangeApi.endpoints.previewExchange.initiate(
      {
        sourceWalletId: 'w-cad',
        targetWalletId: 'w-ngn',
        fixedSide: 'SOURCE',
        amount: toMoney('100'),
      },
      { fixedCacheKey: EXCHANGE_QUOTE_CACHE_KEY },
    ),
  );
}

beforeEach(async () => {
  jest.clearAllMocks();
  setSearchParams({});
  await secureStorage.clearAll();
  await sessionManager.start(
    { userId: 'u-1', accessToken: 'access-0', refreshToken: 'refresh-0', tokenType: 'Bearer' },
    'ada@example.com',
  );
});

describe('ExchangeScreen', () => {
  it('asks for a second currency wallet with the original copy', async () => {
    installFetchMock({
      'GET /wallets': ok([wallet('w-cad', 'CAD', '10.00')]),
      'GET /currencies': CURRENCIES,
    });
    await renderWithProviders(<ExchangeScreen />);

    expect(
      await screen.findByText(
        'You need at least two different currency wallets to perform a swap.',
      ),
    ).toBeTruthy();
    await fireEvent.press(screen.getByText('Create wallet'));
    expect(router.push).toHaveBeenCalledWith('/wallet/create');
  });

  it('shows the amount and rate calculated by the backend, never its own', async () => {
    const { calls } = installFetchMock({
      'GET /wallets': WALLETS,
      'GET /currencies': CURRENCIES,
      // Deliberately not 100 × 1050: the screen must show what the backend returns.
      'POST /exchange/calculate': ok(calculation({ targetAmount: '104999.99' })),
    });
    await renderWithProviders(<ExchangeScreen />);

    await typeIntoNumberField('exchange-send', '100');
    expect(await screen.findByTestId('exchange-rate')).toHaveTextContent('1 CAD = 1,050 NGN');
    expect(screen.getByTestId('exchange-receive')).toHaveTextContent(/104999\.99/);

    const [calc] = posts(calls, '/exchange/calculate');
    expect(calc?.rawBody).toBe(
      '{"sourceWalletId":"w-cad","targetWalletId":"w-ngn","sourceAmount":100}',
    );
    expect(screen.getByTestId('exchange-continue').props.accessibilityState?.disabled).toBe(false);
  });

  it('keeps You receive read-only', async () => {
    installFetchMock({
      'GET /wallets': WALLETS,
      'GET /currencies': CURRENCIES,
      'POST /exchange/calculate': ok(calculation({ targetAmount: '105000.00' })),
    });
    await renderWithProviders(<ExchangeScreen />);

    await typeIntoNumberField('exchange-send', '100');
    expect(await screen.findByTestId('exchange-receive')).toHaveTextContent(/105000\.00/);
    expect(screen.getByTestId('exchange-receive').props.accessibilityState?.disabled).toBe(true);
  });

  it('says the pair cannot be swapped when no rate exists', async () => {
    installFetchMock({
      'GET /wallets': WALLETS,
      'GET /currencies': CURRENCIES,
      'POST /exchange/calculate': fail(404, 'RESOURCE_NOT_FOUND', 'No exchange rate for CAD/USD'),
    });
    await renderWithProviders(<ExchangeScreen />);

    await fireEvent.press(await screen.findByTestId('exchange-target'));
    await fireEvent.press(await screen.findByTestId('exchange-picker-option-w-usd'));
    await typeIntoNumberField('exchange-send', '10');

    expect(await screen.findByText('Cannot currently swap between these currencies.')).toBeTruthy();
    expect(screen.getByTestId('exchange-target')).toHaveTextContent(/USD wallet/);
    expect(screen.getByTestId('exchange-continue').props.accessibilityState?.disabled).toBe(true);
  });

  it('blocks a send amount above the available balance', async () => {
    const { calls } = installFetchMock({
      'GET /wallets': WALLETS,
      'GET /currencies': CURRENCIES,
      'POST /exchange/calculate': ok(
        calculation({ sourceAmount: '600.00', targetAmount: '630000.00' }),
      ),
    });
    await renderWithProviders(<ExchangeScreen />);

    await typeIntoNumberField('exchange-send', '600');
    expect(await screen.findByText('You can exchange up to 500.00 CAD.')).toBeTruthy();
    expect(screen.getByTestId('exchange-continue').props.accessibilityState?.disabled).toBe(true);
    expect(posts(calls, '/exchange/preview')).toHaveLength(0);
  });

  it('locks a quote and opens the review', async () => {
    const { calls } = installFetchMock({
      'GET /wallets': WALLETS,
      'GET /currencies': CURRENCIES,
      'POST /exchange/calculate': ok(calculation()),
      'POST /exchange/preview': created(quote()),
    });
    await renderWithProviders(<ExchangeScreen />);

    await typeIntoNumberField('exchange-send', '100');
    await screen.findByTestId('exchange-rate');
    await fireEvent.press(screen.getByTestId('exchange-continue'));

    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith({
        pathname: '/exchange/review',
        params: { side: 'SOURCE' },
      }),
    );
    expect(posts(calls, '/exchange/preview')[0]?.rawBody).toBe(
      '{"sourceWalletId":"w-cad","targetWalletId":"w-ngn","sourceAmount":100}',
    );
  });

  it('swaps the wallets', async () => {
    installFetchMock({ 'GET /wallets': WALLETS, 'GET /currencies': CURRENCIES });
    await renderWithProviders(<ExchangeScreen />);

    expect(await screen.findByTestId('exchange-source')).toHaveTextContent(/CAD wallet/);
    await fireEvent.press(screen.getByTestId('exchange-swap'));
    expect(screen.getByTestId('exchange-source')).toHaveTextContent(/NGN wallet/);
    expect(screen.getByTestId('exchange-target')).toHaveTextContent(/CAD wallet/);
  });
});

describe('ExchangeReviewScreen', () => {
  const routes = (extra: Record<string, unknown> = {}) => ({
    'GET /currencies': CURRENCIES,
    'GET /security/pin': ok(PIN_STATUS(false)),
    'POST /exchange/preview': created(quote()),
    ...extra,
  });

  it('shows the locked quote and executes it with one idempotency key', async () => {
    const { calls } = installFetchMock(routes({ 'POST /exchange/execute': created(exchange()) }));
    await renderWithProviders(<ExchangeReviewScreen />, { prepareStore: withQuote });

    expect(await screen.findByTestId('exchange-review-send')).toHaveTextContent('100.00 CAD');
    expect(screen.getByTestId('exchange-review-receive')).toHaveTextContent('105,000.00 NGN');
    expect(screen.getByTestId('exchange-review-rate')).toHaveTextContent('1 CAD = 1,050 NGN');
    expect(screen.getByTestId('exchange-countdown')).toHaveTextContent(
      /Quote valid for 0:(59|60)|1:00/,
    );
    expect(screen.queryByText(/fee/i)).toBeNull();

    await fireEvent.press(screen.getByTestId('exchange-confirm'));
    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith({
        pathname: '/exchange/[exchangeId]',
        params: { exchangeId: 'x-1' },
      }),
    );
    const [execute] = posts(calls, '/exchange/execute');
    expect(execute?.rawBody).toBe('{"quoteId":"q-1"}');
    expect(execute?.headers['Idempotency-Key']).toEqual(expect.any(String));
  });

  it('reuses the key when the same quote is retried after a network error', async () => {
    let attempt = 0;
    const { calls } = installFetchMock(
      routes({
        'POST /exchange/execute': () => {
          attempt += 1;
          if (attempt === 1) throw new TypeError('Network request failed');
          return created(exchange());
        },
      }),
    );
    await renderWithProviders(<ExchangeReviewScreen />, { prepareStore: withQuote });

    await fireEvent.press(await screen.findByTestId('exchange-confirm'));
    expect(await screen.findByTestId('exchange-error')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('exchange-confirm'));

    await waitFor(() => expect(router.replace).toHaveBeenCalled());
    const [first, second] = posts(calls, '/exchange/execute');
    expect(second?.headers['Idempotency-Key']).toBe(first?.headers['Idempotency-Key']);
  });

  it('gets a new quote with a new key after the backend says the quote expired', async () => {
    setSearchParams({ side: 'TARGET' });
    const { calls } = installFetchMock(
      routes({
        'POST /exchange/preview': [
          created(quote()),
          created(
            quote({ quoteId: 'q-2', targetAmount: '104000.00', appliedRate: '1040.000000000000' }),
          ),
        ],
        'POST /exchange/execute': [
          fail(409, 'EXCHANGE_QUOTE_EXPIRED'),
          created(exchange({ quoteId: 'q-2' })),
        ],
      }),
    );
    await renderWithProviders(<ExchangeReviewScreen />, { prepareStore: withQuote });

    await fireEvent.press(await screen.findByTestId('exchange-confirm'));
    expect(
      await screen.findByText('This quote has expired. Get a new quote to continue.'),
    ).toBeTruthy();
    expect(screen.queryByTestId('exchange-confirm')).toBeNull();

    await fireEvent.press(screen.getByTestId('exchange-requote'));
    await waitFor(() =>
      expect(screen.getByTestId('exchange-review-receive')).toHaveTextContent('104,000.00 NGN'),
    );
    // The same request again: the typed receive amount, not a recalculated send amount.
    expect(posts(calls, '/exchange/preview')[1]?.rawBody).toBe(
      '{"sourceWalletId":"w-cad","targetWalletId":"w-ngn","targetAmount":105000.00}',
    );
    expect(screen.getByTestId('exchange-review-rate')).toHaveTextContent('1 CAD = 1,040 NGN');

    await fireEvent.press(screen.getByTestId('exchange-confirm'));
    await waitFor(() => expect(router.replace).toHaveBeenCalled());
    const [first, second] = posts(calls, '/exchange/execute');
    expect(second?.rawBody).toBe('{"quoteId":"q-2"}');
    expect(second?.headers['Idempotency-Key']).not.toBe(first?.headers['Idempotency-Key']);
  });

  it('offers only a new quote once the countdown runs out', async () => {
    installFetchMock(
      routes({
        'POST /exchange/preview': created(
          quote({ expiresAt: new Date(Date.now() - 1000).toISOString() }),
        ),
      }),
    );
    await renderWithProviders(<ExchangeReviewScreen />, { prepareStore: withQuote });

    expect(await screen.findByTestId('exchange-expired')).toBeTruthy();
    expect(screen.getByTestId('exchange-requote')).toBeTruthy();
    expect(screen.queryByTestId('exchange-confirm')).toBeNull();
  });

  it('shows the balance error and keeps the quote usable', async () => {
    installFetchMock(
      routes({ 'POST /exchange/execute': fail(422, 'INSUFFICIENT_AVAILABLE_BALANCE') }),
    );
    await renderWithProviders(<ExchangeReviewScreen />, { prepareStore: withQuote });

    await fireEvent.press(await screen.findByTestId('exchange-confirm'));
    expect(
      await screen.findByText("You don't have enough available balance for this exchange."),
    ).toBeTruthy();
    expect(screen.getByTestId('exchange-confirm')).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('asks for the PIN when one is set and sends nothing if cancelled', async () => {
    const { calls } = installFetchMock(
      routes({
        'GET /security/pin': ok(PIN_STATUS(true)),
        'POST /security/pin/verify': ok(),
        'POST /exchange/execute': created(exchange()),
      }),
    );
    await renderWithProviders(<ExchangeReviewScreen />, { prepareStore: withQuote });

    preventScreenCaptureAsync.mockClear();
    await fireEvent.press(await screen.findByTestId('exchange-confirm'));
    await screen.findByTestId('pin-prompt-cancel');
    await waitFor(() => expect(preventScreenCaptureAsync).toHaveBeenCalled());
    await fireEvent.press(screen.getByTestId('pin-prompt-cancel'));
    await waitFor(() => expect(screen.queryByTestId('pin-prompt-entry')).toBeNull());
    expect(posts(calls, '/exchange/execute')).toHaveLength(0);

    await fireEvent.press(screen.getByTestId('exchange-confirm'));
    await enterPin('pin-prompt-entry', '1234');
    await waitFor(() => expect(posts(calls, '/exchange/execute')).toHaveLength(1));
  });

  it('explains when there is no quote to review', async () => {
    installFetchMock(routes());
    await renderWithProviders(<ExchangeReviewScreen />);

    expect(await screen.findByText('Nothing to review')).toBeTruthy();
  });
});

describe('ExchangeResultScreen', () => {
  it('shows the backend result with currencies from the wallets', async () => {
    setSearchParams({ exchangeId: 'x-1' });
    installFetchMock({
      'GET /exchange/transactions/x-1': ok(exchange()),
      'GET /wallets': WALLETS,
      'GET /currencies': CURRENCIES,
    });
    await renderWithProviders(<ExchangeResultScreen />);

    expect(await screen.findByText('Exchange complete')).toBeTruthy();
    expect(screen.getByTestId('movement-amount')).toHaveTextContent('105,000.00 NGN');
    expect(screen.getByTestId('exchange-result-send')).toHaveTextContent('100.00 CAD');
    expect(screen.getByTestId('exchange-result-rate')).toHaveTextContent('1 CAD = 1,050 NGN');
  });

  it('never claims success for a failed exchange', async () => {
    setSearchParams({ exchangeId: 'x-1' });
    installFetchMock({
      'GET /exchange/transactions/x-1': ok(
        exchange({ status: 'FAILED', failureReason: 'Insufficient available balance' }),
      ),
      'GET /wallets': WALLETS,
      'GET /currencies': CURRENCIES,
    });
    await renderWithProviders(<ExchangeResultScreen />);

    expect(await screen.findByText('Exchange failed')).toBeTruthy();
    expect(screen.getByText('Insufficient available balance. Nothing was exchanged.')).toBeTruthy();
    expect(screen.queryByText('Exchange complete')).toBeNull();
  });
});

describe('RatesScreen', () => {
  it('lists currencies, shows published rates exactly and explains a missing pair', async () => {
    const { calls } = installFetchMock({
      'GET /currencies': CURRENCIES,
      'GET /exchange-rates/latest': () => {
        const last = calls[calls.length - 1];
        return last?.query.includes('quote=USD')
          ? fail(404, 'RESOURCE_NOT_FOUND', 'No exchange rate for CAD/USD')
          : ok({
              id: 'r-1',
              baseCurrencyCode: 'CAD',
              quoteCurrencyCode: 'NGN',
              buyRate: '950.000000000000',
              sellRate: '1050.000000000000',
              effectiveDate: '2026-09-26T09:35:04Z',
            });
      },
    });
    await renderWithProviders(<RatesScreen />);

    expect(await screen.findByTestId('rates-currency-USD')).toBeTruthy();
    expect(await screen.findByTestId('rates-buy')).toHaveTextContent('950');
    expect(screen.getByTestId('rates-sell')).toHaveTextContent('1,050');
    expect(calls.find((call) => call.path === '/exchange-rates/latest')?.query).toBe(
      '?base=CAD&quote=NGN',
    );

    await fireEvent.press(screen.getByTestId('rates-quote'));
    await fireEvent.press(await screen.findByTestId('rates-picker-option-USD'));
    expect(await screen.findByText('No rate is published for CAD/USD.')).toBeTruthy();
  });
});
