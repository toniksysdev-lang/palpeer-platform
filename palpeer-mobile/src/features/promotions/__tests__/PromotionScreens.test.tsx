import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Share } from 'react-native';

import { HomeScreen } from '@/features/home/HomeScreen';
import * as saveReceipt from '@/features/transactions/saveReceipt';
import { sessionManager } from '@/services/auth/session';
import { secureStorage } from '@/services/storage/secureStorage';
import { fail, installFetchMock, ok, type RecordedCall } from '@/tests/fetchMock';
import { router, setSearchParams } from '@/tests/mocks/expoRouter';
import { renderWithProviders } from '@/tests/render';

import { CURRENCIES, rawOk } from '../../wallets/__tests__/fixtures';
import { BonusesScreen } from '../screens/BonusesScreen';
import { PromotionsScreen } from '../screens/PromotionsScreen';
import { ReferralsScreen } from '../screens/ReferralsScreen';

jest.mock('expo-router', () => require('../../../tests/mocks/expoRouter'));

const referral = (overrides: Record<string, unknown> = {}) => ({
  id: 'r-1',
  referrerUserId: 'u-1',
  refereeUserId: null,
  referralCode: 'REF0A1B2',
  status: 'OPEN',
  promotionId: null,
  createdAt: '2026-09-29T10:00:00Z',
  ...overrides,
});

const posts = (all: RecordedCall[], path: string) =>
  all.filter((call) => call.method === 'POST' && call.path === path);

beforeEach(async () => {
  jest.clearAllMocks();
  setSearchParams({});
  await secureStorage.clearAll();
  await sessionManager.start(
    { userId: 'u-1', accessToken: 'access-0', refreshToken: 'refresh-0', tokenType: 'Bearer' },
    'ada@example.com',
  );
});

describe('ReferralsScreen', () => {
  const routes = (extra: Record<string, unknown> = {}) => ({
    'POST /promotions/referrals/my-code': ok(referral()),
    'GET /promotions/referrals/mine': ok([
      referral(),
      referral({
        id: 'r-0',
        referralCode: 'REF9999999999',
        refereeUserId: 'u-2',
        status: 'COMPLETED',
      }),
    ]),
    ...extra,
  });

  it('shows my code, shares/copies it and lists only used codes', async () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
    const { setStringAsync } = jest.requireMock('expo-clipboard') as {
      setStringAsync: jest.Mock;
    };
    setStringAsync.mockClear();
    installFetchMock(routes());
    await renderWithProviders(<ReferralsScreen />);

    expect(await screen.findByTestId('referral-code')).toHaveTextContent('REF0A1B2');
    expect(await screen.findByTestId('referral-stats')).toHaveTextContent(/1 friend joined/);
    expect(await screen.findByTestId('referral-r-0')).toHaveTextContent(/Used/);
    expect(screen.queryByTestId('referral-r-1')).toBeNull();

    await fireEvent.press(screen.getByTestId('referral-copy'));
    expect(setStringAsync).toHaveBeenCalledWith('REF0A1B2');

    await fireEvent.press(screen.getByTestId('referral-share'));
    expect(share).toHaveBeenCalledWith({
      message: expect.stringContaining('REF0A1B2'),
    });
  });

  it('applies a friend’s code after confirmation', async () => {
    const { calls } = installFetchMock(
      routes({
        'POST /promotions/referrals/apply': ok(referral({ status: 'COMPLETED' })),
      }) as never,
    );
    await renderWithProviders(<ReferralsScreen />);

    await fireEvent.changeText(await screen.findByTestId('referral-apply-code'), ' ref 1a2b3 ');
    await fireEvent.press(screen.getByTestId('referral-apply'));
    expect(posts(calls, '/promotions/referrals/apply')).toHaveLength(0);
    await fireEvent.press(await screen.findByTestId('confirm-dialog-confirm'));

    await waitFor(() => expect(posts(calls, '/promotions/referrals/apply')).toHaveLength(1));
    expect(posts(calls, '/promotions/referrals/apply')[0]?.body).toEqual({
      referralCode: 'REF1A2B3',
    });
  });

  it('saves the referral code as image or PDF', async () => {
    const saveImage = jest.spyOn(saveReceipt, 'saveReceiptAsImage').mockResolvedValue(undefined);
    const savePdf = jest.spyOn(saveReceipt, 'saveReceiptAsPdf').mockResolvedValue(undefined);
    installFetchMock(routes());
    await renderWithProviders(<ReferralsScreen />);

    await fireEvent.press(await screen.findByTestId('referral-save-image'));
    await waitFor(() => expect(saveImage).toHaveBeenCalled());
    await fireEvent.press(screen.getByTestId('referral-save-pdf'));
    await waitFor(() => expect(savePdf).toHaveBeenCalled());
  });

  it.each([
    [fail(409, 'REFERRAL_ALREADY_APPLIED'), "You've already used a referral code."],
    [fail(409, 'REFERRAL_NOT_OPEN'), /already been used/],
    [fail(400, 'REFERRAL_SELF'), "You can't use your own referral code."],
    [fail(404, 'NOT_FOUND', 'Referral code not found'), /couldn't find that code/],
  ])('explains a rejected code', async (reply, message) => {
    installFetchMock(routes({ 'POST /promotions/referrals/apply': reply }) as never);
    await renderWithProviders(<ReferralsScreen />);

    await fireEvent.changeText(await screen.findByTestId('referral-apply-code'), 'REF1234567890');
    await fireEvent.press(screen.getByTestId('referral-apply'));
    await fireEvent.press(await screen.findByTestId('confirm-dialog-confirm'));
    expect(await screen.findByTestId('referral-apply-error')).toHaveTextContent(message);
  });

  it('pre-fills a code from a referral link without applying it', async () => {
    setSearchParams({ code: 'REF1234567890' });
    const { calls } = installFetchMock(routes());
    await renderWithProviders(<ReferralsScreen />);

    expect((await screen.findByTestId('referral-apply-code')).props.value).toBe('REF1234567890');
    expect(posts(calls, '/promotions/referrals/apply')).toHaveLength(0);
    await fireEvent.press(screen.getByTestId('referral-bonuses'));
    expect(router.push).toHaveBeenCalledWith('/referrals/bonuses');
  });
});

describe('BonusesScreen', () => {
  it('shows exact amounts with their status and never as spendable', async () => {
    installFetchMock({
      'GET /currencies': CURRENCIES,
      'GET /promotions/bonuses/mine/summary': ok([
        {
          currencyCode: 'NGN',
          totalAmount: '1234567.891234567891',
          unusedAmount: '1234567.891234567891',
          usedAmount: '0',
        },
      ]),
      'GET /promotions/bonuses/mine': rawOk(
        '{"content":[{"id":"b-1","userId":"u-1","promotionId":"p-1","referralId":"r-1","amount":1234567.891234567891,"currencyCode":"NGN","status":"PENDING","reason":"Referral bonus","ledgerEntryId":null,"createdAt":"2026-09-29T10:00:00Z"}],"totalElements":1,"totalPages":1,"number":0,"size":20,"first":true,"last":true,"empty":false}',
      ),
    });
    const { store } = await renderWithProviders(<BonusesScreen />);

    expect(await screen.findByTestId('bonus-stat-NGN-total')).toHaveTextContent('1,234,567.89 NGN');
    expect(screen.getByTestId('bonus-stat-NGN-unused')).toHaveTextContent('1,234,567.89 NGN');
    expect(screen.getByTestId('bonus-stat-NGN-used')).toHaveTextContent('0.00 NGN');
    expect(await screen.findByTestId('bonus-b-1-amount')).toHaveTextContent('1,234,567.89 NGN');
    expect(screen.getByTestId('bonus-b-1')).toHaveTextContent(/Pending/);
    expect(screen.getByTestId('bonuses-pending-note')).toBeTruthy();
    expect(JSON.stringify(store.getState())).not.toContain('ledgerEntryId');
  });

  it('shows an empty state', async () => {
    installFetchMock({
      'GET /currencies': CURRENCIES,
      'GET /promotions/bonuses/mine/summary': ok([]),
      'GET /promotions/bonuses/mine': ok({
        content: [],
        totalElements: 0,
        totalPages: 0,
        number: 0,
        size: 20,
        first: true,
        last: true,
        empty: true,
      }),
    });
    await renderWithProviders(<BonusesScreen />);
    expect(await screen.findByText('No bonuses yet')).toBeTruthy();
  });

  it('derives wallet stats from history when summary is unavailable', async () => {
    installFetchMock({
      'GET /currencies': CURRENCIES,
      'GET /promotions/bonuses/mine/summary': fail(404, 'NOT_FOUND'),
      'GET /promotions/bonuses/mine': ok({
        content: [
          {
            id: 'b-1',
            userId: 'u-1',
            promotionId: 'p-1',
            referralId: 'r-1',
            amount: '100.50',
            currencyCode: 'NGN',
            status: 'PENDING',
            reason: 'Referral bonus',
            createdAt: '2026-09-29T10:00:00Z',
          },
          {
            id: 'b-2',
            userId: 'u-1',
            promotionId: 'p-1',
            referralId: 'r-2',
            amount: '25.00',
            currencyCode: 'NGN',
            status: 'GRANTED',
            reason: 'Referral bonus',
            createdAt: '2026-09-28T10:00:00Z',
          },
        ],
        totalElements: 2,
        totalPages: 1,
        number: 0,
        size: 20,
        first: true,
        last: true,
        empty: false,
      }),
    });
    await renderWithProviders(<BonusesScreen />);

    expect(await screen.findByTestId('bonus-stat-NGN-total')).toHaveTextContent('125.50 NGN');
    expect(screen.getByTestId('bonus-stat-NGN-unused')).toHaveTextContent('100.50 NGN');
    expect(screen.getByTestId('bonus-stat-NGN-used')).toHaveTextContent('25.00 NGN');
    expect(screen.getByTestId('bonuses-pending-note')).toBeTruthy();
    expect(screen.getByText('History')).toBeTruthy();
  });
});

describe('Home entry points', () => {
  it('shows the unread badge and a promotions card', async () => {
    installFetchMock({
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
      'GET /transactions/recent': ok([]),
      'GET /notifications/unread-count': ok({ count: 12 }),
      'GET /promotions/active': ok([
        {
          id: 'p-1',
          code: 'REFER10',
          title: 'Invite a friend',
          description: null,
          promotionType: 'REFERRAL',
          active: true,
          startsAt: null,
          endsAt: null,
          bonusAmount: null,
          bonusCurrencyCode: null,
          createdAt: '2026-09-01T00:00:00Z',
        },
      ]),
      'GET /public/marketing-adverts': ok([]),
    });
    await renderWithProviders(<HomeScreen />);

    expect(await screen.findByTestId('home-notifications-badge')).toHaveTextContent('9+');
    expect(await screen.findByTestId('home-promotions')).toHaveTextContent(/Invite a friend/);
    await fireEvent.press(screen.getByTestId('home-promotions'));
    expect(router.push).toHaveBeenCalledWith('/promotions');
    await fireEvent.press(screen.getByTestId('home-notifications'));
    expect(router.push).toHaveBeenCalledWith('/notifications');
  });
});

describe('PromotionsScreen', () => {
  it('lists active promotions with bonus and period, and links referral ones to invites', async () => {
    installFetchMock({
      'GET /currencies': CURRENCIES,
      'GET /promotions/active': ok([
        {
          id: 'p-1',
          code: 'REFER10',
          title: 'Invite a friend',
          description: 'You both get a bonus.',
          promotionType: 'REFERRAL',
          active: true,
          startsAt: null,
          endsAt: '2026-12-31T23:00:00Z',
          bonusAmount: '10.00',
          bonusCurrencyCode: 'CAD',
          createdAt: '2026-09-01T00:00:00Z',
        },
      ]),
    });
    await renderWithProviders(<PromotionsScreen />);

    expect(await screen.findByTestId('promotion-p-1-bonus')).toHaveTextContent('Bonus: 10.00 CAD');
    expect(screen.getByTestId('promotion-p-1')).toHaveTextContent(/Until/);
    await fireEvent.press(screen.getByTestId('promotion-p-1-invite'));
    expect(router.push).toHaveBeenCalledWith('/referrals');
  });

  it('shows an empty state', async () => {
    installFetchMock({ 'GET /currencies': CURRENCIES, 'GET /promotions/active': ok([]) });
    await renderWithProviders(<PromotionsScreen />);
    expect(await screen.findByText('No promotions right now')).toBeTruthy();
  });
});
