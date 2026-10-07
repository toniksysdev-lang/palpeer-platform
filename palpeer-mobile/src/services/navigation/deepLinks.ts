const UUID = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';
const REFERRAL_CODE = /^REF[0-9A-F]{10}$/;
/** Longer than any allowed path; anything bigger is rejected before decoding. */
const MAX_LINK_LENGTH = 512;

/**
 * Every path the app accepts from outside (links and notification taps). Anything else is
 * ignored, so a crafted link can't open arbitrary screens or pass unexpected parameters.
 */
const ROUTES: readonly RegExp[] = [
  new RegExp(`^/transaction/(FUNDING|WITHDRAWAL|EXCHANGE)/${UUID}$`),
  new RegExp(`^/wallet/${UUID}$`),
  new RegExp(`^/p2p/request/${UUID}$`),
  new RegExp(`^/p2p/order/${UUID}$`),
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

/**
 * Turns an incoming URL (`palpeer://wallet/<id>`) or path into an allowed in-app path, or null.
 * Only `/referrals` keeps a query parameter: a well-formed `code`, which only pre-fills the form.
 */
export function resolveDeepLink(input: string | null | undefined): string | null {
  if (!input || input.length > MAX_LINK_LENGTH) return null;
  const parts = split(input);
  if (!parts) return null;
  const { path, query } = parts;
  if (!ROUTES.some((route) => route.test(path))) return null;
  if (path === '/referrals') {
    const code = query.get('code')?.trim().toUpperCase();
    return code && REFERRAL_CODE.test(code) ? `/referrals?code=${code}` : path;
  }
  return path;
}

/** Screen for a notification's `referenceType`. Only `REFERRAL` exists today (NT-3). */
export function notificationTarget(notification: {
  referenceType: string | null;
  referenceId: string | null;
}): string | null {
  switch (notification.referenceType?.toUpperCase()) {
    case 'REFERRAL':
      return '/referrals';
    default:
      return null;
  }
}

const UUID_ONLY = new RegExp(`^${UUID}$`);

/**
 * Where a tapped push goes. The backend push payload isn't defined yet (NT-4), so only fields
 * mirroring `NotificationResponse` are read, and the screen always refetches from the API
 * (R-NT-1). Falls back to the notification center.
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
