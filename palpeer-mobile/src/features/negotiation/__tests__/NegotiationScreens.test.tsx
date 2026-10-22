import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { sessionManager } from '@/services/auth/session';
import { secureStorage } from '@/services/storage/secureStorage';
import { RealtimeContext } from '@/services/websocket/realtime';
import type { AppStore } from '@/store';
import { sessionStarted } from '@/store/slices/sessionSlice';
import { fakeRealtime } from '@/tests/fakeRealtime';
import { fail, installFetchMock, ok, type RecordedCall } from '@/tests/fetchMock';
import { router, setSearchParams } from '@/tests/mocks/expoRouter';
import { typeIntoNumberField } from '@/tests/numberPad';
import { renderWithProviders } from '@/tests/render';

import { created, CURRENCIES, orderSummary, p2pRequest } from '../../p2p/__tests__/fixtures';
import { P2PHistoryScreen } from '../../p2p/screens/P2PHistoryScreen';
import { RequestDetailScreen } from '../../p2p/screens/RequestDetailScreen';
import { MakeOfferScreen } from '../screens/MakeOfferScreen';
import { NegotiationDetailScreen } from '../screens/NegotiationDetailScreen';
import { ME, negotiation, offer, OTHER } from './fixtures';

jest.mock('expo-router', () => require('../../../tests/mocks/expoRouter'));

const signedIn = {
  prepareStore: (store: AppStore) =>
    void store.dispatch(sessionStarted({ userId: ME, email: null })),
};

const callsTo = (calls: RecordedCall[], method: string, path: string) =>
  calls.filter((call) => call.method === method && call.path === path);

/** An offer OTHER made on MY request r-1: it's my turn. */
const onMyRequest = (overrides: Parameters<typeof negotiation>[0] = {}) =>
  negotiation({
    requesterId: ME,
    counterpartyId: OTHER,
    offers: [offer({ offeredBy: OTHER, amount: '90.0000', rate: '1480.000000000000' })],
    ...overrides,
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

describe('MakeOfferScreen', () => {
  it('asks for amount and rate, then opens negotiation chat with a prefilled offer', async () => {
    setSearchParams({ requestId: 'r-1' });
    const { calls } = installFetchMock({
      'GET /currencies': CURRENCIES,
      'GET /p2p/requests/r-1': ok(p2pRequest()),
      'POST /negotiations/offers': created(negotiation({ id: 'n-new' })),
      'POST /chat/rooms': created({
        id: 'room-neg-1',
        p2pOrderId: null,
        negotiationId: 'n-new',
        participantAId: ME,
        participantBId: OTHER,
        createdAt: '2026-09-29T10:00:00Z',
        participantALastReadAt: null,
        participantBLastReadAt: null,
        unreadCount: 0,
      }),
      'POST /chat/rooms/room-neg-1/messages': created({
        id: 'm-offer',
        roomId: 'room-neg-1',
        senderId: ME,
        content: 'My offer',
        clientMessageId: 'c-1',
        createdAt: '2026-09-29T10:00:01Z',
      }),
    });
    await renderWithProviders(<MakeOfferScreen />, signedIn);

    expect(await screen.findByText('What is your best offer?')).toBeTruthy();
    expect(screen.getByTestId('offer-request-rate')).toHaveTextContent(/1 USD = 1,500 NGN/);
    expect(screen.getByTestId('offer-amount')).toHaveTextContent(/100/);
    expect(screen.getByTestId('offer-rate')).toHaveTextContent(/1,?500/);

    await fireEvent.press(screen.getByTestId('offer-amount'));
    for (let i = 0; i < 10; i += 1) {
      await fireEvent.press(screen.getByTestId('number-pad-dock-key-back'));
    }
    await typeIntoNumberField('offer-amount', '90.50');
    await fireEvent.press(screen.getByTestId('offer-submit'));

    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith({
        pathname: '/chat/[roomId]',
        params: { roomId: 'room-neg-1' },
      }),
    );
    expect(callsTo(calls, 'POST', '/negotiations/offers')[0]?.rawBody).toBe(
      '{"p2pRequestId":"r-1","amount":90.5,"rate":1500}',
    );
    expect(callsTo(calls, 'POST', '/chat/rooms')).toHaveLength(1);
    expect(callsTo(calls, 'POST', '/chat/rooms/room-neg-1/messages')).toHaveLength(1);
  });

  it('validates amounts above zero before sending', async () => {
    setSearchParams({ requestId: 'r-1' });
    const { calls } = installFetchMock({
      'GET /currencies': CURRENCIES,
      'GET /p2p/requests/r-1': ok(p2pRequest()),
    });
    await renderWithProviders(<MakeOfferScreen />, signedIn);
    await fireEvent.press(await screen.findByTestId('offer-amount'));
    for (let i = 0; i < 10; i += 1) {
      await fireEvent.press(screen.getByTestId('number-pad-dock-key-back'));
    }
    await typeIntoNumberField('offer-amount', '0');
    await fireEvent.press(screen.getByTestId('offer-submit'));
    expect(await screen.findByText('Enter an amount above zero.')).toBeTruthy();
    expect(callsTo(calls, 'POST', '/negotiations/offers')).toHaveLength(0);
  });

  it('409 NEGOTIATION_EXISTS links to the negotiation chat already open', async () => {
    setSearchParams({ requestId: 'r-1' });
    const { calls } = installFetchMock({
      'GET /currencies': CURRENCIES,
      'GET /p2p/requests/r-1': ok(p2pRequest()),
      'POST /negotiations/offers': fail(409, 'NEGOTIATION_EXISTS'),
      'GET /negotiations/me': ok([negotiation({ id: 'n-open' })]),
      'POST /chat/rooms': created({
        id: 'room-open',
        p2pOrderId: null,
        negotiationId: 'n-open',
        participantAId: ME,
        participantBId: OTHER,
        createdAt: '2026-09-29T10:00:00Z',
        participantALastReadAt: null,
        participantBLastReadAt: null,
        unreadCount: 0,
      }),
    });
    await renderWithProviders(<MakeOfferScreen />, signedIn);
    await fireEvent.press(await screen.findByTestId('offer-submit'));

    expect(await screen.findByTestId('offer-error')).toHaveTextContent(
      'You already have an open offer on this request.',
    );
    await fireEvent.press(await screen.findByTestId('offer-view-existing'));
    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith({
        pathname: '/chat/[roomId]',
        params: { roomId: 'room-open' },
      }),
    );
    expect(callsTo(calls, 'GET', '/negotiations/me')[0]?.query).toBe('?p2pRequestId=r-1');
  });

  it('409 P2P_NOT_OPEN explains the request closed', async () => {
    setSearchParams({ requestId: 'r-1' });
    installFetchMock({
      'GET /currencies': CURRENCIES,
      'GET /p2p/requests/r-1': ok(p2pRequest()),
      'POST /negotiations/offers': fail(409, 'P2P_NOT_OPEN'),
    });
    await renderWithProviders(<MakeOfferScreen />, signedIn);
    await fireEvent.press(await screen.findByTestId('offer-submit'));
    expect(await screen.findByTestId('offer-error')).toHaveTextContent(/no longer open/);
  });
});

describe('NegotiationDetailScreen', () => {
  it("shows history and waits while it's the other person's turn", async () => {
    setSearchParams({ id: 'n-1' });
    installFetchMock({
      'GET /currencies': CURRENCIES,
      'GET /negotiations/n-1': ok(
        negotiation({
          offers: [
            offer({ id: 'o-1', status: 'SUPERSEDED' }),
            offer({
              id: 'o-2',
              offeredBy: OTHER,
              offerType: 'COUNTER',
              status: 'SUPERSEDED',
              rate: '1490',
            }),
            offer({ id: 'o-3', offerType: 'COUNTER', rate: '1470' }),
          ],
        }),
      ),
      'GET /p2p/requests/r-1': ok(p2pRequest()),
    });
    await renderWithProviders(<NegotiationDetailScreen />, signedIn);

    expect(await screen.findByTestId('negotiation-turn')).toHaveTextContent(
      'Waiting for their reply',
    );
    expect(screen.getByTestId('negotiation-role')).toHaveTextContent('Your offer on their request');
    expect(screen.getByTestId('negotiation-offer-o-1')).toHaveTextContent(/You offered/);
    expect(screen.getByTestId('negotiation-offer-o-1')).toHaveTextContent(/Superseded/);
    expect(screen.getByTestId('negotiation-offer-o-2')).toHaveTextContent(/They countered/);
    expect(screen.getByTestId('negotiation-offer-o-3')).toHaveTextContent(/1 USD = 1,470 NGN/);
    expect(screen.getByTestId('negotiation-offer-o-3')).toHaveTextContent(/Pending/);
    expect(screen.queryByTestId('negotiation-accept')).toBeNull();
    expect(screen.queryByTestId('negotiation-counter')).toBeNull();
  });

  it('accepts on my turn, then links to the order it created', async () => {
    setSearchParams({ id: 'n-1' });
    let status: 'OPEN' | 'ACCEPTED' = 'OPEN';
    const { calls } = installFetchMock({
      'GET /currencies': CURRENCIES,
      'GET /negotiations/n-1': () =>
        ok(
          onMyRequest({
            status,
            offers: [
              offer({ offeredBy: OTHER, status: status === 'OPEN' ? 'PENDING' : 'ACCEPTED' }),
            ],
          }),
        ),
      'GET /p2p/requests/r-1': () =>
        ok(p2pRequest({ userId: ME, status: status === 'OPEN' ? 'OPEN' : 'ACCEPTED' })),
      'POST /negotiations/n-1/accept': () => {
        status = 'ACCEPTED';
        return ok(onMyRequest({ status: 'ACCEPTED' }));
      },
      'GET /p2p/me/orders': ok([
        orderSummary({ id: 'o-other', requestId: 'r-9' }),
        orderSummary({ id: 'o-5', requesterId: ME, acceptorId: OTHER }),
      ]),
    });
    await renderWithProviders(<NegotiationDetailScreen />, signedIn);

    expect(await screen.findByTestId('negotiation-turn')).toHaveTextContent('Your turn to reply');
    await fireEvent.press(screen.getByTestId('negotiation-accept'));
    expect(await screen.findByText('Accept this offer?')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('confirm-dialog-confirm'));

    expect(await screen.findByTestId('negotiation-notice')).toHaveTextContent(/Offer accepted/);
    await waitFor(() =>
      expect(screen.getByTestId('negotiation-status')).toHaveTextContent('Accepted'),
    );
    await fireEvent.press(await screen.findByTestId('negotiation-view-order'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/p2p/order/[id]',
      params: { id: 'o-5' },
    });
    expect(callsTo(calls, 'POST', '/negotiations/n-1/accept')[0]?.rawBody).toBeUndefined();
  });

  it('sends a counter-offer with exact decimals', async () => {
    setSearchParams({ id: 'n-1' });
    const { calls } = installFetchMock({
      'GET /currencies': CURRENCIES,
      'GET /negotiations/n-1': [
        ok(onMyRequest()),
        ok(
          onMyRequest({
            offers: [
              offer({ offeredBy: OTHER, status: 'SUPERSEDED' }),
              offer({ id: 'o-2', offerType: 'COUNTER', amount: '95', rate: '1495.5' }),
            ],
          }),
        ),
      ],
      'GET /negotiations/me': ok([]),
      'GET /p2p/requests/r-1': ok(p2pRequest({ userId: ME })),
      'POST /negotiations/n-1/counter': ok(onMyRequest()),
    });
    await renderWithProviders(<NegotiationDetailScreen />, signedIn);

    await fireEvent.press(await screen.findByTestId('negotiation-counter'));
    expect(screen.getByTestId('counter-amount')).toHaveTextContent(/90/);
    expect(screen.getByTestId('counter-rate')).toHaveTextContent(/1,480/);
    await fireEvent.press(screen.getByTestId('counter-amount'));
    for (let i = 0; i < 10; i += 1) {
      await fireEvent.press(screen.getByTestId('number-pad-dock-key-back'));
    }
    await typeIntoNumberField('counter-amount', '95');
    await fireEvent.press(screen.getByTestId('negotiation-counter-submit'));

    expect(await screen.findByTestId('negotiation-notice')).toHaveTextContent(
      'Counter-offer sent.',
    );
    expect(callsTo(calls, 'POST', '/negotiations/n-1/counter')[0]?.rawBody).toBe(
      '{"amount":95,"rate":1480}',
    );
    expect(await screen.findByTestId('negotiation-turn')).toHaveTextContent(
      'Waiting for their reply',
    );
  });

  it('409 NEGOTIATION_WAIT_TURN: the other side moved first', async () => {
    setSearchParams({ id: 'n-1' });
    installFetchMock({
      'GET /currencies': CURRENCIES,
      'GET /negotiations/n-1': ok(onMyRequest()),
      'GET /negotiations/me': ok([]),
      'GET /p2p/requests/r-1': ok(p2pRequest({ userId: ME })),
      'POST /negotiations/n-1/counter': fail(409, 'NEGOTIATION_WAIT_TURN'),
    });
    await renderWithProviders(<NegotiationDetailScreen />, signedIn);
    await fireEvent.press(await screen.findByTestId('negotiation-counter'));
    await fireEvent.press(screen.getByTestId('negotiation-counter-submit'));
    expect(await screen.findByTestId('negotiation-error')).toHaveTextContent(
      "It's the other person's turn to reply.",
    );
  });

  it('hides Accept when the request is no longer open, since the backend would refuse it', async () => {
    setSearchParams({ id: 'n-1' });
    installFetchMock({
      'GET /currencies': CURRENCIES,
      'GET /negotiations/n-1': ok(onMyRequest()),
      'GET /p2p/requests/r-1': ok(p2pRequest({ userId: ME, status: 'ACCEPTED' })),
    });
    await renderWithProviders(<NegotiationDetailScreen />, signedIn);
    expect(await screen.findByTestId('negotiation-request-closed')).toBeTruthy();
    expect(screen.queryByTestId('negotiation-accept')).toBeNull();
  });

  it('links straight to the order the accept created, without searching my orders', async () => {
    setSearchParams({ id: 'n-1' });
    const { calls } = installFetchMock({
      'GET /currencies': CURRENCIES,
      'GET /negotiations/n-1': ok(
        onMyRequest({
          status: 'ACCEPTED',
          p2pOrderId: 'o-7',
          offers: [offer({ offeredBy: OTHER, status: 'ACCEPTED' })],
        }),
      ),
      'GET /p2p/requests/r-1': ok(p2pRequest({ userId: ME, status: 'ACCEPTED' })),
    });
    await renderWithProviders(<NegotiationDetailScreen />, signedIn);
    await fireEvent.press(await screen.findByTestId('negotiation-view-order'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/p2p/order/[id]',
      params: { id: 'o-7' },
    });
    expect(callsTo(calls, 'GET', '/p2p/me/orders')).toHaveLength(0);
  });

  it('declines on my turn after confirming, which ends the negotiation', async () => {
    setSearchParams({ id: 'n-1' });
    let declined = false;
    const { calls } = installFetchMock({
      'GET /currencies': CURRENCIES,
      'GET /negotiations/n-1': () =>
        ok(
          declined
            ? onMyRequest({
                status: 'CANCELLED',
                closedReason: 'REJECTED',
                closedBy: ME,
                offers: [offer({ offeredBy: OTHER, status: 'REJECTED' })],
              })
            : onMyRequest(),
        ),
      'GET /negotiations/me': ok([]),
      'GET /p2p/requests/r-1': ok(p2pRequest({ userId: ME })),
      'POST /negotiations/n-1/reject': () => {
        declined = true;
        return ok(onMyRequest({ status: 'CANCELLED', closedReason: 'REJECTED', closedBy: ME }));
      },
    });
    await renderWithProviders(<NegotiationDetailScreen />, signedIn);

    await fireEvent.press(await screen.findByTestId('negotiation-decline'));
    expect(await screen.findByText('Decline this offer?')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('confirm-dialog-confirm'));

    expect(await screen.findByTestId('negotiation-notice')).toHaveTextContent('Offer declined.');
    await waitFor(() =>
      expect(screen.getByTestId('negotiation-turn')).toHaveTextContent('You declined their offer.'),
    );
    expect(screen.queryByTestId('negotiation-decline')).toBeNull();
    expect(screen.queryByTestId('negotiation-cancel')).toBeNull();
    expect(callsTo(calls, 'POST', '/negotiations/n-1/reject')).toHaveLength(1);
  });

  it("lets me cancel while waiting for the other person's reply", async () => {
    setSearchParams({ id: 'n-1' });
    const { calls } = installFetchMock({
      'GET /currencies': CURRENCIES,
      'GET /negotiations/n-1': [
        ok(negotiation()),
        ok(negotiation({ status: 'CANCELLED', closedReason: 'CANCELLED', closedBy: ME })),
      ],
      'GET /negotiations/me': ok([]),
      'GET /p2p/requests/r-1': ok(p2pRequest()),
      'POST /negotiations/n-1/cancel': ok(
        negotiation({ status: 'CANCELLED', closedReason: 'CANCELLED', closedBy: ME }),
      ),
    });
    await renderWithProviders(<NegotiationDetailScreen />, signedIn);

    expect(screen.queryByTestId('negotiation-decline')).toBeNull();
    await fireEvent.press(await screen.findByTestId('negotiation-cancel'));
    expect(await screen.findByText('Cancel this negotiation?')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('confirm-dialog-confirm'));

    expect(await screen.findByTestId('negotiation-notice')).toHaveTextContent(
      'Negotiation cancelled.',
    );
    await waitFor(() =>
      expect(screen.getByTestId('negotiation-turn')).toHaveTextContent(
        'You cancelled this negotiation.',
      ),
    );
    expect(callsTo(calls, 'POST', '/negotiations/n-1/cancel')[0]?.rawBody).toBeUndefined();
  });

  it.each([
    [{ closedReason: 'REJECTED', closedBy: OTHER }, 'They declined your offer.'],
    [{ closedReason: 'CANCELLED', closedBy: OTHER }, 'They cancelled this negotiation.'],
    [{ closedReason: 'REQUEST_CLOSED', closedBy: null }, /request is no longer open/],
  ] as const)('explains how it ended: %o', async (closed, text) => {
    setSearchParams({ id: 'n-1' });
    installFetchMock({
      'GET /currencies': CURRENCIES,
      'GET /negotiations/n-1': ok(negotiation({ status: 'CANCELLED', ...closed })),
      'GET /p2p/requests/r-1': ok(p2pRequest()),
    });
    await renderWithProviders(<NegotiationDetailScreen />, signedIn);
    expect(await screen.findByTestId('negotiation-turn')).toHaveTextContent(text);
    expect(screen.queryByTestId('negotiation-cancel')).toBeNull();
  });

  it('updates live when the other person replies, without polling', async () => {
    setSearchParams({ id: 'n-1' });
    const realtime = fakeRealtime();
    const { calls } = installFetchMock({
      'GET /currencies': CURRENCIES,
      'GET /negotiations/n-1': ok(negotiation()),
      'GET /negotiations/me': ok([]),
      'GET /p2p/requests/r-1': ok(p2pRequest()),
    });
    await renderWithProviders(
      <RealtimeContext.Provider value={realtime.connection}>
        <NegotiationDetailScreen />
      </RealtimeContext.Provider>,
      signedIn,
    );
    expect(await screen.findByTestId('negotiation-turn')).toHaveTextContent(
      'Waiting for their reply',
    );
    expect(realtime.listening()).toContain('/user/queue/negotiations');

    await realtime.push(
      '/user/queue/negotiations',
      `{"id":"n-1","p2pRequestId":"r-1","requesterId":"${OTHER}","counterpartyId":"${ME}",` +
        '"status":"OPEN","currentOfferId":"o-2","createdAt":"2026-09-29T09:00:00Z",' +
        '"p2pOrderId":null,"closedReason":null,"closedBy":null,"offers":[' +
        `{"id":"o-1","offeredBy":"${ME}","offerType":"OFFER","amount":100.0000,"rate":1450.000000000000,"status":"SUPERSEDED","createdAt":"2026-09-29T09:00:00Z"},` +
        `{"id":"o-2","offeredBy":"${OTHER}","offerType":"COUNTER","amount":95.1234,"rate":1475.123456,"status":"PENDING","createdAt":"2026-09-29T09:05:00Z"}]}`,
    );

    await waitFor(() =>
      expect(screen.getByTestId('negotiation-turn')).toHaveTextContent('Your turn to reply'),
    );
    expect(screen.getByTestId('negotiation-offer-o-2')).toHaveTextContent(/1,475\.123456 NGN/);
    expect(screen.getByTestId('negotiation-decline')).toBeTruthy();
    expect(callsTo(calls, 'GET', '/negotiations/n-1')).toHaveLength(1);
  });

  it('re-reads the negotiation after the connection comes back', async () => {
    setSearchParams({ id: 'n-1' });
    const realtime = fakeRealtime();
    const { calls } = installFetchMock({
      'GET /currencies': CURRENCIES,
      'GET /negotiations/n-1': [
        ok(negotiation()),
        ok(negotiation({ status: 'CANCELLED', closedReason: 'REQUEST_CLOSED' })),
      ],
      'GET /p2p/requests/r-1': ok(p2pRequest()),
    });
    await renderWithProviders(
      <RealtimeContext.Provider value={realtime.connection}>
        <NegotiationDetailScreen />
      </RealtimeContext.Provider>,
      signedIn,
    );
    await screen.findByTestId('negotiation-turn');
    await realtime.reconnected();
    await waitFor(() =>
      expect(screen.getByTestId('negotiation-turn')).toHaveTextContent(/no longer open/),
    );
    expect(callsTo(calls, 'GET', '/negotiations/n-1')).toHaveLength(2);
  });

  it('409 P2P_NOT_OPEN on accept is explained', async () => {
    setSearchParams({ id: 'n-1' });
    installFetchMock({
      'GET /currencies': CURRENCIES,
      'GET /negotiations/n-1': ok(onMyRequest()),
      'GET /negotiations/me': ok([]),
      'GET /p2p/requests/r-1': ok(p2pRequest({ userId: ME })),
      'GET /p2p/requests': ok([]),
      'GET /p2p/me/requests': ok([]),
      'GET /p2p/me/orders': ok([]),
      'POST /negotiations/n-1/accept': fail(409, 'P2P_NOT_OPEN'),
    });
    await renderWithProviders(<NegotiationDetailScreen />, signedIn);
    await fireEvent.press(await screen.findByTestId('negotiation-accept'));
    await fireEvent.press(await screen.findByTestId('confirm-dialog-confirm'));
    expect(await screen.findByTestId('negotiation-error')).toHaveTextContent(/no longer open/);
  });
});

describe('offers in P2P screens', () => {
  it("lists offers in history with the request's pair and whose turn it is", async () => {
    setSearchParams({ tab: 'offers' });
    installFetchMock({
      'GET /currencies': CURRENCIES,
      'GET /p2p/me/requests': ok([]),
      'GET /p2p/me/orders': ok([]),
      'GET /negotiations/me': ok([
        negotiation({ id: 'n-1' }),
        onMyRequest({ id: 'n-2', p2pRequestId: 'r-2' }),
      ]),
      'GET /p2p/requests/r-1': ok(p2pRequest()),
      'GET /p2p/requests/r-2': ok(p2pRequest({ id: 'r-2', userId: ME, baseCurrencyCode: 'CAD' })),
    });
    await renderWithProviders(<P2PHistoryScreen />, signedIn);

    const mine = await screen.findByTestId('negotiation-n-1');
    await waitFor(() => expect(mine).toHaveTextContent(/USD\/NGN/));
    expect(mine).toHaveTextContent(/Your offer · Waiting for their reply/);
    await waitFor(() =>
      expect(screen.getByTestId('negotiation-n-2')).toHaveTextContent(
        /Offer on your request · Your turn to reply/,
      ),
    );
    await fireEvent.press(mine);
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/negotiation/[id]',
      params: { id: 'n-1' },
    });
  });

  it('shows the empty offers state', async () => {
    setSearchParams({ tab: 'offers' });
    installFetchMock({
      'GET /currencies': CURRENCIES,
      'GET /p2p/me/requests': ok([]),
      'GET /p2p/me/orders': ok([]),
      'GET /negotiations/me': ok([]),
    });
    await renderWithProviders(<P2PHistoryScreen />, signedIn);
    expect(await screen.findByText('No offers yet')).toBeTruthy();
  });

  it('lets a non-owner make an offer and opens the buyer–seller chat', async () => {
    setSearchParams({ id: 'r-1' });
    const { calls } = installFetchMock({
      'GET /currencies': CURRENCIES,
      'GET /wallets': ok([]),
      'GET /p2p/requests/r-1': ok(p2pRequest()),
      'GET /negotiations/me': ok([]),
      'POST /negotiations/offers': created(negotiation({ id: 'n-new' })),
      'POST /chat/rooms': created({
        id: 'room-neg-1',
        p2pOrderId: null,
        negotiationId: 'n-new',
        participantAId: ME,
        participantBId: OTHER,
        createdAt: '2026-09-29T10:00:00Z',
        participantALastReadAt: null,
        participantBLastReadAt: null,
        unreadCount: 0,
      }),
    });
    await renderWithProviders(<RequestDetailScreen />, signedIn);
    await fireEvent.press(await screen.findByTestId('p2p-make-offer'));
    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith({
        pathname: '/chat/[roomId]',
        params: { roomId: 'room-neg-1' },
      }),
    );
    expect(callsTo(calls, 'POST', '/negotiations/offers')[0]?.rawBody).toBe(
      '{"p2pRequestId":"r-1","amount":100,"rate":1500}',
    );
    expect(callsTo(calls, 'POST', '/chat/rooms')[0]?.rawBody).toBe('{"negotiationId":"n-new"}');
    // Buyer picks a suggested message in chat — nothing is auto-sent here.
    expect(callsTo(calls, 'POST', '/chat/rooms/room-neg-1/messages')).toHaveLength(0);
  });

  it('opens the existing offer chat instead of starting a second negotiation', async () => {
    setSearchParams({ id: 'r-1' });
    const { calls } = installFetchMock({
      'GET /currencies': CURRENCIES,
      'GET /wallets': ok([]),
      'GET /p2p/requests/r-1': ok(p2pRequest()),
      'GET /negotiations/me': ok([negotiation({ id: 'n-1' })]),
      'POST /chat/rooms': created({
        id: 'room-n-1',
        p2pOrderId: null,
        negotiationId: 'n-1',
        participantAId: ME,
        participantBId: OTHER,
        createdAt: '2026-09-29T10:00:00Z',
        participantALastReadAt: null,
        participantBLastReadAt: null,
        unreadCount: 0,
      }),
    });
    await renderWithProviders(<RequestDetailScreen />, signedIn);
    await fireEvent.press(await screen.findByTestId('p2p-view-offer'));
    expect(screen.queryByTestId('p2p-make-offer')).toBeNull();
    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith({
        pathname: '/chat/[roomId]',
        params: { roomId: 'room-n-1' },
      }),
    );
    expect(callsTo(calls, 'POST', '/negotiations/offers')).toHaveLength(0);
    expect(callsTo(calls, 'POST', '/chat/rooms')[0]?.rawBody).toBe('{"negotiationId":"n-1"}');
  });

  it('shows the owner every offer on their request', async () => {
    setSearchParams({ id: 'r-1' });
    installFetchMock({
      'GET /currencies': CURRENCIES,
      'GET /p2p/requests/r-1': ok(p2pRequest({ userId: ME })),
      'GET /negotiations/me': ok([
        onMyRequest({ id: 'n-a' }),
        onMyRequest({ id: 'n-b', counterpartyId: 'u-3' }),
      ]),
    });
    await renderWithProviders(<RequestDetailScreen />, signedIn);
    expect(await screen.findByTestId('p2p-request-offers')).toHaveTextContent(/Offers \(2\)/);
    await fireEvent.press(screen.getByTestId('negotiation-n-b'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/negotiation/[id]',
      params: { id: 'n-b' },
    });
  });
});
