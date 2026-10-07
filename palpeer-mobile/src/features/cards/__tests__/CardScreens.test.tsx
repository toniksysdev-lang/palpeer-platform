import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { enterPin, PIN_STATUS } from '@/features/security/__tests__/helpers';
import { sessionManager } from '@/services/auth/session';
import { secureStorage } from '@/services/storage/secureStorage';
import { fail, installFetchMock, ok, type RecordedCall } from '@/tests/fetchMock';
import { router, setSearchParams } from '@/tests/mocks/expoRouter';
import { renderWithProviders } from '@/tests/render';

import { CURRENCIES, wallet } from '../../wallets/__tests__/fixtures';
import { CardDetailScreen } from '../screens/CardDetailScreen';
import { CardsScreen } from '../screens/CardsScreen';
import { IssueCardScreen } from '../screens/IssueCardScreen';
import { card, cardPage, cardTransaction } from './fixtures';

jest.mock('expo-router', () => require('../../../tests/mocks/expoRouter'));

const SECRETS = [
  'stub_secret_provider_ref',
  'stub_tx_ref',
  'providerCardId',
  'providerTransactionId',
];

const posts = (calls: RecordedCall[], path: string) =>
  calls.filter((call) => call.method === 'POST' && call.path === path);

const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });

/** Nothing sensitive reaches the screen or the Redux cache. */
function renderedStrings(node: unknown, out: string[] = []): string[] {
  if (typeof node === 'string') {
    out.push(node);
  } else if (Array.isArray(node)) {
    node.forEach((child) => renderedStrings(child, out));
  } else if (node && typeof node === 'object') {
    const { props, children } = node as { props?: Record<string, unknown>; children?: unknown };
    Object.values(props ?? {}).forEach((value) => {
      if (typeof value === 'string') out.push(value);
    });
    renderedStrings(children, out);
  }
  return out;
}

function expectNoSecrets(store: { getState: () => unknown }) {
  const rendered = renderedStrings(screen.toJSON()).join('\n');
  const state = JSON.stringify(store.getState());
  for (const secret of SECRETS) {
    expect(rendered).not.toContain(secret);
    expect(state).not.toContain(secret);
  }
  expect(rendered).not.toMatch(/\d{12,}/);
  expect(rendered).not.toMatch(/cvv|cvc/i);
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

describe('CardsScreen', () => {
  it('lists cards masked, labels test cards and keeps issuer ids out of the app', async () => {
    installFetchMock({
      'GET /cards': ok([card(), card({ id: 'card-2', lastFour: '1881', status: 'BLOCKED' })]),
    });
    const { store } = await renderWithProviders(<CardsScreen />);

    expect(await screen.findByTestId('card-number-card-1')).toHaveTextContent('•••• 4242');
    expect(screen.getByTestId('card-test-label-card-1')).toHaveTextContent('Test card');
    expect(screen.getByTestId('card-row-card-2')).toHaveTextContent(/Frozen/);
    expectNoSecrets(store);

    await fireEvent.press(screen.getByTestId('card-row-card-2'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/cards/[id]', params: { id: 'card-2' } });
  });

  it('shows an empty state that leads to issuing a card', async () => {
    installFetchMock({ 'GET /cards': ok([]) });
    await renderWithProviders(<CardsScreen />);

    await fireEvent.press(await screen.findByText('Issue a card'));
    expect(router.push).toHaveBeenCalledWith('/cards/create');
  });
});

describe('IssueCardScreen', () => {
  const routes = (extra: Record<string, unknown> = {}) => ({
    'GET /currencies': CURRENCIES,
    'GET /wallets': ok([wallet('w-cad', 'CAD', '10.00')]),
    ...extra,
  });

  it('issues a card linked to the same-currency wallet after confirmation', async () => {
    const { calls } = installFetchMock(
      routes({
        'POST /cards': { status: 201, body: { success: true, data: card(), timestamp: '' } },
      }) as never,
    );
    const { store } = await renderWithProviders(<IssueCardScreen />);

    await fireEvent.press(await screen.findByTestId('issue-card-currency-NGN'));
    expect(screen.queryByTestId('issue-card-link')).toBeNull();

    await fireEvent.press(screen.getByTestId('issue-card-currency-CAD'));
    await fireEvent(screen.getByTestId('issue-card-link-switch'), 'valueChange', true);
    await fireEvent.changeText(screen.getByTestId('issue-card-holder'), '  Ada Lovelace ');
    await fireEvent.press(screen.getByTestId('issue-card-submit'));
    expect(posts(calls, '/cards')).toHaveLength(0);

    await fireEvent.press(await screen.findByTestId('confirm-dialog-confirm'));
    await waitFor(() => expect(posts(calls, '/cards')).toHaveLength(1));
    expect(posts(calls, '/cards')[0]?.body).toEqual({
      currencyCode: 'CAD',
      walletId: 'w-cad',
      cardholderName: 'Ada Lovelace',
    });
    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith({
        pathname: '/cards/[id]',
        params: { id: 'card-1' },
      }),
    );
    expectNoSecrets(store);
  });

  it('sends only the currency when nothing else is chosen and shows backend errors', async () => {
    const { calls } = installFetchMock(
      routes({
        'POST /cards': fail(400, 'CARD_WALLET_CURRENCY_MISMATCH', 'Wallet currency mismatch'),
      }) as never,
    );
    await renderWithProviders(<IssueCardScreen />);

    await fireEvent.press(await screen.findByTestId('issue-card-currency-USD'));
    await fireEvent.press(screen.getByTestId('issue-card-submit'));
    await fireEvent.press(await screen.findByTestId('confirm-dialog-confirm'));

    expect(await screen.findByTestId('issue-card-error')).toHaveTextContent(/same currency/);
    expect(posts(calls, '/cards')[0]?.body).toEqual({ currencyCode: 'USD' });
    expect(router.replace).not.toHaveBeenCalled();
  });
});

describe('CardDetailScreen', () => {
  function detailRoutes(pinSet: boolean, extra: Record<string, unknown> = {}) {
    let current = card();
    const mock = installFetchMock({
      'GET /currencies': CURRENCIES,
      'GET /cards/card-1': () => ok(current),
      'GET /cards/card-1/transactions': ok(cardPage([])),
      'GET /security/pin': ok(PIN_STATUS(pinSet)),
      'POST /cards/card-1/block': () => {
        current = card({ status: 'BLOCKED' });
        return ok(current);
      },
      'POST /cards/card-1/unblock': () => {
        current = card({ status: 'ACTIVE' });
        return ok(current);
      },
      'POST /security/pin/verify': ok(),
      ...extra,
    } as never);
    return {
      ...mock,
      setCard: (next: ReturnType<typeof card>) => {
        current = next;
      },
    };
  }

  beforeEach(() => setSearchParams({ id: 'card-1' }));

  it('shows masked details, the unavailable funding notice and no card secrets', async () => {
    detailRoutes(false, { 'GET /cards/card-1': ok(card({ walletId: 'w-cad' })) });
    const { store } = await renderWithProviders(<CardDetailScreen />);

    expect(await screen.findByTestId('card-number-card-1')).toHaveTextContent('•••• 4242');
    expect(screen.getByTestId('card-status')).toHaveTextContent('Active');
    expect(screen.getByTestId('card-linked-wallet')).toHaveTextContent('CAD wallet');
    expect(screen.getByTestId('card-test-notice')).toBeTruthy();
    expect(screen.getByTestId('card-funding-unavailable')).toBeTruthy();
    expect(await screen.findByText('No card transactions yet')).toBeTruthy();
    expectNoSecrets(store);
  });

  it('freezes after confirmation without asking for the PIN', async () => {
    const { calls } = detailRoutes(true);
    await renderWithProviders(<CardDetailScreen />);

    await fireEvent.press(await screen.findByTestId('card-freeze'));
    expect(posts(calls, '/cards/card-1/block')).toHaveLength(0);
    await fireEvent.press(await screen.findByTestId('confirm-dialog-confirm'));

    await waitFor(() => expect(posts(calls, '/cards/card-1/block')).toHaveLength(1));
    expect(await screen.findByTestId('card-unfreeze')).toBeTruthy();
    expect(screen.getByTestId('card-status')).toHaveTextContent('Frozen');
    expect(posts(calls, '/security/pin/verify')).toHaveLength(0);
  });

  it('asks for the PIN before unfreezing and does nothing if it is cancelled', async () => {
    const { calls, setCard } = detailRoutes(true);
    setCard(card({ status: 'BLOCKED' }));
    await renderWithProviders(<CardDetailScreen />);

    await fireEvent.press(await screen.findByTestId('card-unfreeze'));
    await fireEvent.press(await screen.findByTestId('confirm-dialog-confirm'));
    await fireEvent.press(await screen.findByTestId('pin-prompt-cancel'));
    await waitFor(() => expect(screen.queryByTestId('pin-prompt-entry')).toBeNull());
    expect(posts(calls, '/cards/card-1/unblock')).toHaveLength(0);

    await fireEvent.press(screen.getByTestId('card-unfreeze'));
    await fireEvent.press(await screen.findByTestId('confirm-dialog-confirm'));
    await enterPin('pin-prompt-entry', '1234');

    await waitFor(() => expect(posts(calls, '/cards/card-1/unblock')).toHaveLength(1));
    expect(await screen.findByTestId('card-freeze')).toBeTruthy();
  });

  it('unfreezes with just a confirmation when no PIN is set', async () => {
    const { calls, setCard } = detailRoutes(false);
    setCard(card({ status: 'BLOCKED' }));
    await renderWithProviders(<CardDetailScreen />);

    await fireEvent.press(await screen.findByTestId('card-unfreeze'));
    await fireEvent.press(await screen.findByTestId('confirm-dialog-confirm'));

    await waitFor(() => expect(posts(calls, '/cards/card-1/unblock')).toHaveLength(1));
    expect(posts(calls, '/security/pin/verify')).toHaveLength(0);
  });

  it('shows the backend conflict when the card can no longer be frozen', async () => {
    detailRoutes(false, {
      'POST /cards/card-1/block': fail(409, 'CARD_CLOSED', 'Card is closed'),
    });
    await renderWithProviders(<CardDetailScreen />);

    await fireEvent.press(await screen.findByTestId('card-freeze'));
    await fireEvent.press(await screen.findByTestId('confirm-dialog-confirm'));
    expect(await screen.findByTestId('card-action-error')).toHaveTextContent(/closed/);
  });

  it('pages card transactions and strips provider references', async () => {
    let served = 0;
    const { calls } = detailRoutes(false, {
      'GET /cards/card-1/transactions': () => {
        served += 1;
        return served === 1
          ? ok(cardPage([cardTransaction()], { number: 0, last: false }))
          : ok(
              cardPage(
                [
                  cardTransaction({
                    id: 'ct-2',
                    entryType: 'REFUND',
                    merchantName: null,
                    amount: '3.00',
                  }),
                ],
                { number: 1 },
              ),
            );
      },
    });
    const { store } = await renderWithProviders(<CardDetailScreen />);

    expect(await screen.findByTestId('card-transaction-ct-1')).toHaveTextContent(/Coffee Shop/);
    expect(screen.getByTestId('card-transaction-ct-1-amount')).toHaveTextContent('12.50 CAD');
    await fireEvent.press(screen.getByTestId('card-transactions-more'));

    expect(await screen.findByTestId('card-transaction-ct-2-amount')).toHaveTextContent(
      '+3.00 CAD',
    );
    expect(screen.getByTestId('card-transaction-ct-2')).toHaveTextContent(/Refund/);
    const second = calls.filter((call) => call.path === '/cards/card-1/transactions')[1];
    expect(new URLSearchParams(second?.query ?? '').get('page')).toBe('1');
    await settle();
    expectNoSecrets(store);
  });

  it("shows a not-found state for someone else's card", async () => {
    installFetchMock({
      'GET /cards/card-1': fail(404, 'NOT_FOUND', 'Card not found'),
      'GET /cards/card-1/transactions': fail(404, 'NOT_FOUND', 'Card not found'),
    });
    await renderWithProviders(<CardDetailScreen />);

    expect(await screen.findByText("This card wasn't found.")).toBeTruthy();
  });
});
