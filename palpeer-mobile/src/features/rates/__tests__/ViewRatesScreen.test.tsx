import { fireEvent, screen } from '@testing-library/react-native';

import { pendingNavigation } from '@/services/navigation/pendingNavigation';
import type { AppStore } from '@/store';
import { sessionStarted } from '@/store/slices/sessionSlice';
import { installFetchMock, ok } from '@/tests/fetchMock';
import { router } from '@/tests/mocks/expoRouter';
import { renderWithProviders } from '@/tests/render';

import { ViewRatesScreen } from '../screens/ViewRatesScreen';

jest.mock('expo-router', () => require('../../../tests/mocks/expoRouter'));

const SELL_RATE = {
  id: 'r-sell-1',
  side: 'SELL',
  baseCurrencyCode: 'CAD',
  quoteCurrencyCode: 'NGN',
  amount: 100,
  rate: '1500',
  expiresAt: new Date(Date.now() + 3600_000).toISOString(),
  createdAt: new Date().toISOString(),
};

const BUY_RATE = {
  ...SELL_RATE,
  id: 'r-buy-1',
  side: 'BUY',
};

beforeEach(() => {
  jest.clearAllMocks();
  pendingNavigation.clear();
});

describe('ViewRatesScreen — Live P2P Buy This Exchange', () => {
  it('queues the sell request and opens login when signed out', async () => {
    installFetchMock({
      'GET /public/p2p-rates': ok([SELL_RATE]),
      'GET /public/instant-rates': ok([]),
    });
    await renderWithProviders(<ViewRatesScreen />);

    await fireEvent.press(await screen.findByTestId('view-rates-p2p-buy-r-sell-1'));

    expect(pendingNavigation.peek()).toBe('/p2p/request/r-sell-1');
    expect(router.push).toHaveBeenCalledWith('/login');
  });

  it('opens the sell request when already signed in', async () => {
    installFetchMock({
      'GET /public/p2p-rates': ok([SELL_RATE]),
      'GET /public/instant-rates': ok([]),
    });
    await renderWithProviders(<ViewRatesScreen />, {
      prepareStore: (store: AppStore) =>
        void store.dispatch(sessionStarted({ userId: 'u-1', email: null })),
    });

    await fireEvent.press(await screen.findByTestId('view-rates-p2p-buy-r-sell-1'));

    expect(pendingNavigation.peek()).toBeNull();
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/p2p/request/[id]',
      params: { id: 'r-sell-1' },
    });
  });

  it('hides Buy This Exchange on buy-side listings', async () => {
    installFetchMock({
      'GET /public/p2p-rates': ok([BUY_RATE]),
      'GET /public/instant-rates': ok([]),
    });
    await renderWithProviders(<ViewRatesScreen />);

    expect(await screen.findByTestId('view-rates-p2p-r-buy-1')).toBeTruthy();
    expect(screen.queryByTestId('view-rates-p2p-buy-r-buy-1')).toBeNull();
  });
});
