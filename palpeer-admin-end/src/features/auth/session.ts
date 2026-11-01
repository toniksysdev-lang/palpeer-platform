import type { AuthTokens } from '@/types/api';
import { looksLikeJwt } from '@/lib/tokenShape';

const ACCESS_KEY = 'palpeer.admin.accessToken';
const REFRESH_KEY = 'palpeer.admin.refreshToken';
const USER_KEY = 'palpeer.admin.userId';
const REMEMBER_KEY = 'palpeer.admin.remember';
const REMEMBER_EMAIL_KEY = 'palpeer.admin.rememberEmail';
const DEVICE_KEY = 'palpeer.admin.deviceId';

/**
 * Stable per-browser id for single-session login. Survives sign-out so re-login on this
 * console is treated as the same device (avoids legacy SESSION_ALREADY_ACTIVE deadlocks).
 */
export function getOrCreateAdminDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_KEY);
    if (existing && existing.length >= 8 && existing.length <= 128) {
      return existing;
    }
    const id =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? `admin-web:${crypto.randomUUID()}`
        : `admin-web:${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(DEVICE_KEY, id.slice(0, 128));
    return localStorage.getItem(DEVICE_KEY) ?? id.slice(0, 128);
  } catch {
    return `admin-web:ephemeral-${Date.now().toString(36)}`;
  }
}

function store(remember: boolean): Storage {
  return remember ? localStorage : sessionStorage;
}

function otherStore(remember: boolean): Storage {
  return remember ? sessionStorage : localStorage;
}

function isRememberEnabled(): boolean {
  return localStorage.getItem(REMEMBER_KEY) === 'true';
}

function clearTokenKeys(target: Storage) {
  target.removeItem(ACCESS_KEY);
  target.removeItem(REFRESH_KEY);
  target.removeItem(USER_KEY);
}

/** Drop tokens from the storage that must not own this session. */
function purgeOppositeStore(remember: boolean) {
  clearTokenKeys(otherStore(remember));
}

/** Last "Remember session" checkbox preference (defaults to false). */
export function loadRememberPreference(): boolean {
  return isRememberEnabled();
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

/**
 * Load the active admin session.
 *
 * Remembered sessions live only in localStorage (survive browser close).
 * Ephemeral sessions live only in sessionStorage (cleared when the browser session ends).
 * Tokens are never read across stores — that previously resurrected signed-in state after
 * closing the browser even when "Remember session" was off.
 */
export function loadPersistedSession(): PersistedSession | null {
  const remember = isRememberEnabled();
  purgeOppositeStore(remember);

  const storage = store(remember);
  const accessToken = storage.getItem(ACCESS_KEY);
  const refreshToken = storage.getItem(REFRESH_KEY);
  const userId = storage.getItem(USER_KEY);

  if (!accessToken || !refreshToken || !userId) {
    clearTokenKeys(storage);
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
  // Wipe both stores first so a flip between remember on/off cannot leave orphans.
  clearSession();
  localStorage.setItem(REMEMBER_KEY, String(remember));
  if (remember && rememberedEmail) {
    localStorage.setItem(REMEMBER_EMAIL_KEY, rememberedEmail);
  } else if (!remember) {
    // Ephemeral login: do not keep a saved email that implies a durable session.
    localStorage.removeItem(REMEMBER_EMAIL_KEY);
  }
  const storage = store(remember);
  storage.setItem(ACCESS_KEY, tokens.accessToken);
  storage.setItem(REFRESH_KEY, tokens.refreshToken);
  storage.setItem(USER_KEY, tokens.userId);
  purgeOppositeStore(remember);
}

export function persistRotatedTokens(tokens: AuthTokens) {
  const remember = isRememberEnabled();
  persistSession(tokens, remember);
}

export function clearSession() {
  clearBoth(ACCESS_KEY);
  clearBoth(REFRESH_KEY);
  clearBoth(USER_KEY);
  // Keep REMEMBER_KEY / REMEMBER_EMAIL_KEY so the sign-in form can restore preference + email.
}

function tokenFromActiveStore(key: string): string | null {
  const remember = isRememberEnabled();
  purgeOppositeStore(remember);
  return store(remember).getItem(key);
}

export function getAccessToken(): string | null {
  const token = tokenFromActiveStore(ACCESS_KEY);
  if (!looksLikeJwt(token)) {
    if (token) clearSession();
    return null;
  }
  return token;
}

export function getRefreshToken(): string | null {
  const token = tokenFromActiveStore(REFRESH_KEY);
  if (!looksLikeJwt(token)) {
    if (token) clearSession();
    return null;
  }
  return token;
}
