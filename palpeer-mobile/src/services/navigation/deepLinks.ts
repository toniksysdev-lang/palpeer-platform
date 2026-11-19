const UUID = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';
/** New codes are REF + 5 hex (8 chars); older codes used a longer hex suffix. */
const REFERRAL_CODE = /^REF[0-9A-F]{5,20}$/;
/** Longer than any allowed path; anything bigger is rejected before decoding. */
const MAX_LINK_LENGTH = 512;

/**
 * Every path the app accepts from outside (links and notification taps). Anything else is
 * ignored, so a crafted link can't open arbitrary screens or pass unexpected parameters.
 */
const ROUTES: readonly RegExp[] = [
  new RegExp(`^/transaction/(FUNDING|WITHDRAWAL|EXCHANGE|TRANSFER)/${UUID}$`),
  new RegExp(`^/wallet/${UUID}$`),
  new RegExp(`^/p2p/request/${UUID}$`),
  new RegExp(`^/p2p/order/${UUID}$`),
  new RegExp(`^/p2p/share/${UUID}$`),
  new RegExp(`^/negotiation/${UUID}$`),
  new RegExp(`^/chat/${UUID}$`),
  new RegExp(`^/cards/${UUID}$`),
  new RegExp(`^/notifications/${UUID}$`),
  /^\/notifications$/,
  /^\/kyc$/,
  /^\/promotions$/,
  /^\/referrals$/,
  /^\/activity$/,
  /^\/People$/,
  /^\/PeopleOffer$/,
  /^\/PeopleTalk$/,
  /^\/PeopleLive$/,
  /^\/PeoplePost$/,
  /^\/Messages$/,
  /^\/Terms$/,
  /^\/PrivacyPolicy$/,
];

/** Strips `palpeer://`, `exp+palpeer://` or a leading slash and splits off the query. */
function split(input: string): { path: string; query: URLSearchParams } | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const withoutScheme = trimmed.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
  const [rawPath = '', rawQuery = ''] = withoutScheme.split('?', 2);
  let path: string;
  try {
    path = decodeURIComponent(rawPath.split('#')[0] ?? '');
  } catch {
    return null;
  }
  path = `/${path.replace(/^\/+/, '').replace(/\/+$/, '')}`;
  return { path, query: new URLSearchParams(rawQuery.split('#')[0] ?? '') };
}

/**
 * HTTPS share URLs arrive as `/host/p2p/share/<id>` after scheme strip.
 * Accept the marketing host and the API bridge host.
 */
function stripShareHost(path: string): string {
  const match = path.match(
    new RegExp(
      `^/(?:app\\.palpeer\\.com|palpeer-api\\.onrender\\.com)(/p2p/share/${UUID})$`,
      'i',
    ),
  );
  return match?.[1] ?? path;
}

/**
 * Turns an incoming URL (`palpeer://wallet/<id>`) or path into an allowed in-app path, or null.
 * Only `/referrals` keeps a query parameter: a well-formed `code`, which only pre-fills the form.
 * Share links map to the public guest route `/p2p-share/<id>`.
 */
export function resolveDeepLink(input: string | null | undefined): string | null {
  if (!input || input.length > MAX_LINK_LENGTH) return null;
  const parts = split(input);
  if (!parts) return null;
  const { query } = parts;
  const path = stripShareHost(parts.path);
  if (!ROUTES.some((route) => route.test(path))) return null;
  if (path === '/referrals') {
    const code = query.get('code')?.trim().toUpperCase();
    return code && REFERRAL_CODE.test(code) ? `/referrals?code=${code}` : path;
  }
  const shareMatch = path.match(new RegExp(`^/p2p/share/(${UUID})$`));
  if (shareMatch?.[1]) return `/p2p-share/${shareMatch[1]}`;
  // Legacy authenticated request detail → newui People offer.
  const requestMatch = path.match(new RegExp(`^/p2p/request/(${UUID})$`));
  if (requestMatch?.[1]) return `/PeopleOffer?requestId=${requestMatch[1]}`;
  // Design Card screen (legacy /cards/:id still accepted as input).
  const cardMatch = path.match(new RegExp(`^/cards/(${UUID})$`));
  if (cardMatch?.[1]) return `/Card?id=${cardMatch[1]}`;
  // Design History (legacy /activity tab).
  if (path === '/activity') return '/History';
  // Preserve safe query keys for People deep links from pushes/alerts.
  if (
    path === '/PeopleOffer' ||
    path === '/PeopleTalk' ||
    path === '/PeopleLive' ||
    path === '/People' ||
    path === '/PeoplePost'
  ) {
    const requestId = query.get('requestId');
    const negotiationId = query.get('negotiationId');
    const nudge = query.get('nudge');
    const amount = query.get('amount');
    const giveCode = query.get('giveCode');
    const qs = new URLSearchParams();
    if (requestId && UUID_ONLY.test(requestId)) qs.set('requestId', requestId);
    if (negotiationId && UUID_ONLY.test(negotiationId)) qs.set('negotiationId', negotiationId);
    if (nudge === '1' || nudge === 'true') qs.set('nudge', '1');
    if (amount && /^\d+(\.\d+)?$/.test(amount)) qs.set('amount', amount);
    if (giveCode === 'CAD' || giveCode === 'NGN') qs.set('giveCode', giveCode);
    const q = qs.toString();
    return q ? `${path}?${q}` : path;
  }
  // Push taps land on Messages → Alerts.
  if (path === '/Messages') {
    const section = query.get('section');
    if (section === 'alerts' || section === 'talks' || section === 'chats') {
      return `/Messages?section=${section}`;
    }
    return path;
  }
  return path;
}

/** Guest share destinations open immediately while signed out (not queued for after login). */
export function isGuestDeepLink(path: string | null | undefined): boolean {
  return !!path && path.startsWith('/p2p-share/');
}

const UUID_ONLY = new RegExp(`^${UUID}$`);

function titleHint(title: string | null | undefined): string {
  return (title || '').trim().toLowerCase();
}

/**
 * Screen for a notification's `referenceType` (NT-3).
 * Used when the user taps a row inside Messages → Alerts (not the push tray).
 */
export function notificationTarget(notification: {
  referenceType: string | null;
  referenceId: string | null;
  title?: string | null;
}): string | null {
  const type = notification.referenceType?.toUpperCase();
  const id = notification.referenceId;
  const title = titleHint(notification.title);

  // In-Alerts actions still open the matching Trade / Talk screen.
  if (
    title.includes('p2p order posted') ||
    title.includes('my offer closed') ||
    title.includes('my offer ended')
  ) {
    return '/People';
  }
  if (title.includes('ends in 30 minutes') || title.includes('offer ends soon')) {
    return id && UUID_ONLY.test(id)
      ? `/PeopleLive?requestId=${id}&nudge=1`
      : '/PeopleLive';
  }
  if (title.includes('new price offer') || title.includes('talk about') || title.includes('price talk')) {
    return id && UUID_ONLY.test(id) ? `/PeopleTalk?negotiationId=${id}` : '/PeopleTalk';
  }

  switch (type) {
    case 'REFERRAL':
      return '/referrals';
    case 'FUNDING':
    case 'WITHDRAWAL':
    case 'EXCHANGE':
    case 'TRANSFER':
      return id && UUID_ONLY.test(id) ? `/transaction/${type}/${id}` : null;
    case 'P2P_REQUEST':
      return id && UUID_ONLY.test(id) ? `/PeopleOffer?requestId=${id}` : '/People';
    case 'P2P_ORDER':
      return id && UUID_ONLY.test(id) ? `/p2p/order/${id}` : null;
    case 'NEGOTIATION':
      return id && UUID_ONLY.test(id) ? `/PeopleTalk?negotiationId=${id}` : '/PeopleTalk';
    case 'ADMIN_BROADCAST':
      return null;
    case 'P2P':
      return '/People';
    default:
      return null;
  }
}

/** Every push tray tap opens Messages → Alerts (NT-4). In-app alert rows still use notificationTarget. */
export const MESSAGES_ALERTS_PATH = '/Messages?section=alerts';

/**
 * Where a tapped push goes. FCM may include `deepLink`; we still land on Messages → Alerts.
 */
export function pushTarget(_data: unknown): string {
  return MESSAGES_ALERTS_PATH;
}
