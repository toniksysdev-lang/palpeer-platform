import { redirectSystemPath } from '@/app/+native-intent';
import { notificationTarget, pushTarget, resolveDeepLink } from '@/services/navigation/deepLinks';
import { pendingNavigation } from '@/services/navigation/pendingNavigation';

const ID = '3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b';

afterEach(() => pendingNavigation.clear());

describe('resolveDeepLink', () => {
  it.each([
    [`palpeer://wallet/${ID}`, `/wallet/${ID}`],
    [`palpeer:///wallet/${ID}/`, `/wallet/${ID}`],
    [`/transaction/EXCHANGE/${ID}`, `/transaction/EXCHANGE/${ID}`],
    [`palpeer://p2p/request/${ID}`, `/p2p/request/${ID}`],
    [`palpeer://p2p/order/${ID}`, `/p2p/order/${ID}`],
    [`palpeer://negotiation/${ID}`, `/negotiation/${ID}`],
    [`palpeer://chat/${ID}`, `/chat/${ID}`],
    [`palpeer://cards/${ID}`, `/cards/${ID}`],
    [`palpeer://notifications/${ID}`, `/notifications/${ID}`],
    ['palpeer://notifications', '/notifications'],
    ['palpeer://kyc', '/kyc'],
    ['palpeer://promotions', '/promotions'],
    ['palpeer://activity', '/activity'],
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
    expect(resolveDeepLink('palpeer://referrals?code=ref0123456789')).toBe(
      '/referrals?code=REF0123456789',
    );
    expect(resolveDeepLink('palpeer://referrals?code=REF0123456789&x=1')).toBe(
      '/referrals?code=REF0123456789',
    );
    expect(resolveDeepLink('palpeer://referrals?code=<script>')).toBe('/referrals');
    expect(resolveDeepLink('palpeer://referrals')).toBe('/referrals');
  });

  it('rejects oversized links before decoding them', () => {
    expect(resolveDeepLink(`palpeer://referrals?pad=${'%25'.repeat(200)}`)).toBeNull();
  });
});

describe('notification and push targets', () => {
  it('maps REFERRAL notifications to the referrals screen and nothing else', () => {
    expect(notificationTarget({ referenceType: 'REFERRAL', referenceId: ID })).toBe('/referrals');
    expect(notificationTarget({ referenceType: 'WITHDRAWAL', referenceId: ID })).toBeNull();
    expect(notificationTarget({ referenceType: null, referenceId: null })).toBeNull();
  });

  it('opens the notification detail for a notification id, else the mapped screen or the center', () => {
    expect(pushTarget({ notificationId: ID })).toBe(`/notifications/${ID}`);
    expect(pushTarget({ notificationId: '../../security' })).toBe('/notifications');
    expect(pushTarget({ referenceType: 'REFERRAL' })).toBe('/referrals');
    expect(pushTarget({ url: 'palpeer://security/pin/change' })).toBe('/notifications');
    expect(pushTarget(undefined)).toBe('/notifications');
  });
});

describe('redirectSystemPath', () => {
  it('queues an allowed link and always lands on home', () => {
    expect(redirectSystemPath({ path: `palpeer://wallet/${ID}`, initial: true })).toBe('/');
    expect(pendingNavigation.take()).toBe(`/wallet/${ID}`);
  });

  it('ignores unknown links', () => {
    expect(redirectSystemPath({ path: 'palpeer://security/pin/change', initial: false })).toBe('/');
    expect(pendingNavigation.peek()).toBeNull();
  });
});
