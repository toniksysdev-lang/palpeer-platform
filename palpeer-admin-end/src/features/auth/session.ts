import type { AuthTokens } from '@/types/api';
import { looksLikeJwt } from '@/lib/tokenShape';

const ACCESS_KEY = 'palpeer.admin.accessToken';
const REFRESH_KEY = 'palpeer.admin.refreshToken';
const USER_KEY = 'palpeer.admin.userId';
const REMEMBER_KEY = 'palpeer.admin.remember';
const REMEMBER_EMAIL_KEY = 'palpeer.admin.rememberEmail';

function store(remember: boolean): Storage {
  return remember ? localStorage : sessionStorage;
}

/** Last "Remember session" checkbox preference (defaults to false). */
export function loadRememberPreference(): boolean {
  return localStorage.getItem(REMEMBER_KEY) === 'true';
}

/** Email saved when the operator last signed in with Remember session. */
export function loadRememberedEmail(): string | null {
  const email = localStorage.getItem(REMEMBER_EMAIL_KEY);
  return email && email.includes('@') ? email : null;
}

function clearBoth(key: string) {
  sessionStorage.removeItem(key);
  localStorage.removeItem(key);
}

export type PersistedSession = {
  userId: string;
  accessToken: string;
  refreshToken: string;
  remember: boolean;
};

export function loadPersistedSession(): PersistedSession | null {
  const remember = localStorage.getItem(REMEMBER_KEY) === 'true';
  const storage = store(remember);
  const accessToken =
    storage.getItem(ACCESS_KEY) ?? localStorage.getItem(ACCESS_KEY) ?? sessionStorage.getItem(ACCESS_KEY);
  const refreshToken =
    storage.getItem(REFRESH_KEY) ?? localStorage.getItem(REFRESH_KEY) ?? sessionStorage.getItem(REFRESH_KEY);
  const userId = storage.getItem(USER_KEY) ?? localStorage.getItem(USER_KEY) ?? sessionStorage.getItem(USER_KEY);

  if (!accessToken || !refreshToken || !userId) {
    return null;
  }

  if (!looksLikeJwt(accessToken) || !looksLikeJwt(refreshToken) || userId.length > 128) {
    clearSession();
    return null;
  }

  return { userId, accessToken, refreshToken, remember };
}

export function persistSession(
  tokens: AuthTokens,
  remember: boolean,
  options?: { email?: string | null },
) {
  if (!looksLikeJwt(tokens.accessToken) || !looksLikeJwt(tokens.refreshToken) || !tokens.userId) {
    clearSession();
    throw new Error('Refusing to persist malformed auth tokens.');
  }

  const rememberedEmail = options?.email?.trim().toLowerCase() || loadRememberedEmail();
  clearSession();
  localStorage.setItem(REMEMBER_KEY, String(remember));
  if (remember && rememberedEmail) {
    localStorage.setItem(REMEMBER_EMAIL_KEY, rememberedEmail);
  } else {
    localStorage.removeItem(REMEMBER_EMAIL_KEY);
  }
  const storage = store(remember);
  storage.setItem(ACCESS_KEY, tokens.accessToken);
  storage.setItem(REFRESH_KEY, tokens.refreshToken);
  storage.setItem(USER_KEY, tokens.userId);
}

export function persistRotatedTokens(tokens: AuthTokens) {
  const remember = localStorage.getItem(REMEMBER_KEY) === 'true';
  persistSession(tokens, remember);
}

export function clearSession() {
  clearBoth(ACCESS_KEY);
  clearBoth(REFRESH_KEY);
  clearBoth(USER_KEY);
  // Keep REMEMBER_KEY / REMEMBER_EMAIL_KEY so the sign-in form can restore preference + email.
}

export function getAccessToken(): string | null {
  const token = localStorage.getItem(ACCESS_KEY) ?? sessionStorage.getItem(ACCESS_KEY);
  if (!looksLikeJwt(token)) {
    if (token) clearSession();
    return null;
  }
  return token;
}

export function getRefreshToken(): string | null {
  const token = localStorage.getItem(REFRESH_KEY) ?? sessionStorage.getItem(REFRESH_KEY);
  if (!looksLikeJwt(token)) {
    if (token) clearSession();
    return null;
  }
  return token;
}
