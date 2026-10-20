const UUID = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';
const REFERRAL_CODE = /^REF[0-9A-F]{10}$/;
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

/** `https://app.palpeer.com/p2p/share/<id>` arrives as `/app.palpeer.com/p2p/share/<id>` after scheme strip. */
function stripShareHost(path: string): string {
  const match = path.match(new RegExp(`^/app\\.palpeer\\.com(/p2p/share/${UUID})$`, 'i'));
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
  return path;
}

/** Guest share destinations open immediately while signed out (not queued for after login). */
export function isGuestDeepLink(path: string | null | undefined): boolean {
  return !!path && path.startsWith('/p2p-share/');
}

const UUID_ONLY = new RegExp(`^${UUID}$`);

/** Screen for a notification's `referenceType` (NT-3). */
export function notificationTarget(notification: {
  referenceType: string | null;
  referenceId: string | null;
}): string | null {
  const type = notification.referenceType?.toUpperCase();
  const id = notification.referenceId;
  switch (type) {
    case 'REFERRAL':
      return '/referrals';
    case 'FUNDING':
    case 'WITHDRAWAL':
    case 'EXCHANGE':
    case 'TRANSFER':
      return id && UUID_ONLY.test(id) ? `/transaction/${type}/${id}` : null;
    case 'P2P_REQUEST':
      return id && UUID_ONLY.test(id) ? `/p2p/request/${id}` : null;
    case 'P2P_ORDER':
      return id && UUID_ONLY.test(id) ? `/p2p/order/${id}` : null;
    case 'NEGOTIATION':
      return id && UUID_ONLY.test(id) ? `/negotiation/${id}` : null;
    case 'ADMIN_BROADCAST':
    case 'P2P':
      return '/notifications';
    default:
      return null;
  }
}

/**
 * Where a tapped push goes. FCM data includes `notificationId` / `referenceType` /
 * `referenceId` (NT-4). The screen always refetches from the API (R-NT-1).
 */
export function pushTarget(data: unknown): string {
  const record = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  const notificationId = record.notificationId;
  if (typeof notificationId === 'string' && UUID_ONLY.test(notificationId)) {
    return `/notifications/${notificationId}`;
  }
  const referenceType = typeof record.referenceType === 'string' ? record.referenceType : null;
  const referenceId = typeof record.referenceId === 'string' ? record.referenceId : null;
  return notificationTarget({ referenceType, referenceId }) ?? '/notifications';
}
