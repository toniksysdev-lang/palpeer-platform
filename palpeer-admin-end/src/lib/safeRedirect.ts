/**
 * Restrict post-login redirects to same-origin admin paths.
 * Blocks protocol-relative URLs, external hosts, and non-admin routes.
 */
export function safeAdminRedirect(
  candidate: unknown,
  fallback = '/admin/dashboard',
): string {
  if (typeof candidate !== 'string') return fallback;

  const raw = candidate.trim();
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) {
    return fallback;
  }

  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return fallback;
  }

  if (
    !decoded.startsWith('/admin') ||
    decoded.startsWith('//') ||
    decoded.includes('://') ||
    decoded.includes('@')
  ) {
    return fallback;
  }

  return decoded;
}
