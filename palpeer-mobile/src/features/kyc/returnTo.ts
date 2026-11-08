/**
 * Safe in-app return path after KYC capture (e.g. design StartChecking).
 * Rejects empty, protocol-relative, or non-path values.
 */
export function safeKycReturnTo(
  value: string | string[] | undefined,
  fallback: string,
): string {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || typeof raw !== 'string') return fallback;
  const trimmed = raw.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return fallback;
  return trimmed;
}

/** Build the next KYC route while preserving an optional returnTo. */
export function kycHref(
  pathname: '/kyc/selfie' | '/kyc/submit' | '/kyc' | '/kyc/document-type',
  returnTo?: string,
): { pathname: string; params?: { returnTo: string } } | string {
  if (!returnTo || pathname === '/kyc' || pathname === '/kyc/document-type') {
    return pathname;
  }
  return { pathname, params: { returnTo } };
}
