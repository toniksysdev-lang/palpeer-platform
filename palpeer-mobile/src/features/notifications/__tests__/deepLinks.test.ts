import { redirectSystemPath } from '@/app/+native-intent';
import {
  MESSAGES_ALERTS_PATH,
  notificationTarget,
  pushTarget,
  resolveDeepLink,
} from '@/services/navigation/deepLinks';
import { pendingNavigation } from '@/services/navigation/pendingNavigation';

const ID = '3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b';

afterEach(() => pendingNavigation.clear());

describe('resolveDeepLink', () => {
  it.each([
    [`palpeer://wallet/${ID}`, `/wallet/${ID}`],
    [`palpeer:///wallet/${ID}/`, `/wallet/${ID}`],
    [`/transaction/EXCHANGE/${ID}`, `/transaction/EXCHANGE/${ID}`],
    [`palpeer://p2p/request/${ID}`, `/PeopleOffer?requestId=${ID}`],
    [`palpeer://p2p/order/${ID}`, `/p2p/order/${ID}`],
    [`palpeer://p2p/share/${ID}`, `/p2p-share/${ID}`],
    [`https://app.palpeer.com/p2p/share/${ID}`, `/p2p-share/${ID}`],
    [`https://api.palpeer.com/p2p/share/${ID}`, `/p2p-share/${ID}`],
    [`https://palpeer-api.onrender.com/p2p/share/${ID}`, `/p2p-share/${ID}`],
    [`palpeer://negotiation/${ID}`, `/negotiation/${ID}`],
    [`palpeer://chat/${ID}`, `/chat/${ID}`],
    [`palpeer://cards/${ID}`, `/Card?id=${ID}`],
    [`palpeer://notifications/${ID}`, `/notifications/${ID}`],
    ['palpeer://notifications', '/notifications'],
    ['palpeer://kyc', '/kyc'],
    ['palpeer://promotions', '/promotions'],
    ['palpeer://activity', '/History'],
    ['palpeer://Messages?section=alerts', '/Messages?section=alerts'],
  ])('allows %s', (input, expected) => {
    expect(resolveDeepLink(input)).toBe(expected);
  });

  it.each([
    'palpeer://wallet/not-a-uuid',
    `palpeer://wallet/${ID}/withdraw`,
    'palpeer://security/pin/change',
    'palpeer://design-system',
    `palpeer://transaction/P2P/${ID}`,
    'palpeer://notifications/settings',
    'palpeer://wallet/..%2Fsecurity',
    'https://evil.example/wallet',
    'exp+palpeer://expo-development-client/?url=http://10.0.2.2:8081',
    '',
    null,
  ])('rejects %s', (input) => {
    expect(resolveDeepLink(input)).toBeNull();
  });

  it('keeps only a well-formed referral code', () => {
    expect(resolveDeepLink('palpeer://referrals?code=ref0a1b2')).toBe('/referrals?code=REF0A1B2');
    expect(resolveDeepLink('palpeer://referrals?code=REF0A1B2&x=1')).toBe(
      '/referrals?code=REF0A1B2',
    );
  });
});

describe('notificationTarget', () => {
  it('maps reference types used by the Alerts list', () => {
    expect(notificationTarget({ referenceType: 'FUNDING', referenceId: ID })).toBe(
      `/transaction/FUNDING/${ID}`,
    );
    expect(notificationTarget({ referenceType: 'TRANSFER', referenceId: ID })).toBe(
      `/transaction/TRANSFER/${ID}`,
    );
    expect(notificationTarget({ referenceType: 'NEGOTIATION', referenceId: ID })).toBe(
      `/PeopleTalk?negotiationId=${ID}`,
    );
    expect(notificationTarget({ referenceType: 'ADMIN_BROADCAST', referenceId: null })).toBeNull();
    expect(notificationTarget({ referenceType: null, referenceId: null })).toBeNull();
  });

  it('routes marketplace alert titles to Trade / Talk / My offer', () => {
    expect(
      notificationTarget({
        referenceType: 'P2P_REQUEST',
        referenceId: ID,
        title: 'P2P order posted',
      }),
    ).toBe('/People');
    expect(
      notificationTarget({
        referenceType: 'P2P_REQUEST',
        referenceId: ID,
        title: 'My offer closed',
      }),
    ).toBe('/People');
    expect(
      notificationTarget({
        referenceType: 'NEGOTIATION',
        referenceId: ID,
        title: 'New price offer',
      }),
    ).toBe(`/PeopleTalk?negotiationId=${ID}`);
    expect(
      notificationTarget({
        referenceType: 'P2P_REQUEST',
        referenceId: ID,
        title: 'Your offer ends in 30 minutes',
      }),
    ).toBe(`/PeopleLive?requestId=${ID}&nudge=1`);
  });
});

describe('pushTarget', () => {
  it('sends every push tap to Messages → Alerts', () => {
    expect(pushTarget({ notificationId: ID })).toBe(MESSAGES_ALERTS_PATH);
    expect(pushTarget({ notificationId: '../../security' })).toBe(MESSAGES_ALERTS_PATH);
    expect(pushTarget({ referenceType: 'REFERRAL' })).toBe(MESSAGES_ALERTS_PATH);
    expect(pushTarget({ url: 'palpeer://security/pin/change' })).toBe(MESSAGES_ALERTS_PATH);
    expect(pushTarget(undefined)).toBe(MESSAGES_ALERTS_PATH);
    expect(
      pushTarget({
        notificationId: ID,
        referenceType: 'P2P_REQUEST',
        referenceId: ID,
        deepLink: `palpeer://p2p/request/${ID}`,
      }),
    ).toBe(MESSAGES_ALERTS_PATH);
    expect(
      pushTarget({
        notificationId: ID,
        referenceType: 'NEGOTIATION',
        referenceId: ID,
        title: 'New price offer',
        deepLink: `palpeer://PeopleTalk?negotiationId=${ID}`,
      }),
    ).toBe(MESSAGES_ALERTS_PATH);
    expect(
      pushTarget({
        notificationId: ID,
        referenceType: 'NEGOTIATION',
        referenceId: ID,
        title: 'Price talk ended',
      }),
    ).toBe(MESSAGES_ALERTS_PATH);
  });
});

describe('redirectSystemPath', () => {
  it('queues an allowed link and always lands on home', () => {
    expect(redirectSystemPath({ path: `palpeer://wallet/${ID}`, initial: true })).toBe('/');
    expect(pendingNavigation.take()).toBe(`/wallet/${ID}`);
  });

  it('opens guest share links immediately without queuing', () => {
    expect(redirectSystemPath({ path: `palpeer://p2p/share/${ID}`, initial: true })).toBe(
      `/p2p-share/${ID}`,
    );
  });
});
