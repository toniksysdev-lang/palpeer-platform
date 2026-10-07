import { describe, expect, it } from 'vitest';
import { decodeJwtPayload, isJwtExpired } from '@/lib/jwt';
import { looksLikeJwt } from '@/lib/tokenShape';

function encode(value: object): string {
  return btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

describe('looksLikeJwt', () => {
  it('requires three non-empty segments', () => {
    expect(looksLikeJwt('a.b.c')).toBe(true);
    expect(looksLikeJwt('a.b')).toBe(false);
    expect(looksLikeJwt('')).toBe(false);
    expect(looksLikeJwt(null)).toBe(false);
  });
});

describe('decodeJwtPayload / isJwtExpired', () => {
  it('decodes payload without verifying signature', () => {
    const token = `${encode({ alg: 'none' })}.${encode({ email: 'ops@palpeer.local', exp: 9_999_999_999 })}.sig`;
    expect(decodeJwtPayload(token)?.email).toBe('ops@palpeer.local');
    expect(isJwtExpired(token)).toBe(false);
  });

  it('treats missing/expired exp as expired', () => {
    const expired = `${encode({ alg: 'none' })}.${encode({ exp: 1 })}.sig`;
    expect(isJwtExpired(expired)).toBe(true);
    expect(isJwtExpired('bad-token')).toBe(true);
  });
});
