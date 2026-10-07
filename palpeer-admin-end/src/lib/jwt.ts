export type JwtAccessPayload = {
  sub?: string;
  email?: string;
  token_type?: string;
  exp?: number;
  iat?: number;
  iss?: string;
};

/** Decode JWT payload without verifying signature (display / expiry only). */
export function decodeJwtPayload(token: string): JwtAccessPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2 || !parts[1]) return null;
    const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
    const json = atob(padded);
    return JSON.parse(json) as JwtAccessPayload;
  } catch {
    return null;
  }
}

export function isJwtExpired(token: string, skewSeconds = 30): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) return true;
  const now = Math.floor(Date.now() / 1000);
  return payload.exp <= now + skewSeconds;
}
