/** Minimal JWT shape check (header.payload.signature) — no signature verification. */
export function looksLikeJwt(token: string | null | undefined): boolean {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  return parts.length === 3 && parts.every((part) => part.length > 0);
}
