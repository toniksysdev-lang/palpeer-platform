import { Platform } from 'react-native';

export type AppEnvironment = 'development' | 'staging' | 'production';

/** Contact and legal details supplied per build. Anything missing or malformed is null (SP-1). */
export type SupportConfig = {
  email: string | null;
  phone: string | null;
  privacyPolicyUrl: string | null;
  termsUrl: string | null;
};

/** HTTPS base for shareable deep links (App Links / Universal Links). Null → use palpeer://. */
export type ShareConfig = {
  baseUrl: string | null;
  androidStoreUrl: string;
  iosStoreUrl: string | null;
};

export type AppConfig = {
  env: AppEnvironment;
  apiBaseUrl: string;
  wsUrl: string;
  requestTimeoutMs: number;
  sessionRestoreTimeoutMs: number;
  support: SupportConfig;
  google: GoogleAuthConfig;
  share: ShareConfig;
};

/** OAuth client IDs for Google Sign-In. Web client ID is required to obtain an ID token. */
export type GoogleAuthConfig = {
  webClientId: string | null;
  androidClientId: string | null;
  iosClientId: string | null;
};

const ENVIRONMENTS: readonly AppEnvironment[] = ['development', 'staging', 'production'];

function parseEnvironment(value: string | undefined): AppEnvironment {
  return ENVIRONMENTS.find((env) => env === value) ?? 'development';
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?[0-9][0-9 ()-]{4,24}$/;

function parseEmail(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return EMAIL_PATTERN.test(trimmed) ? trimmed : null;
}

function parsePhone(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return PHONE_PATTERN.test(trimmed) ? trimmed : null;
}

/** Legal pages open in the system browser, so only https links are accepted. */
function parseHttpsUrl(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  if (!/^https:\/\/[^\s/?#]+\.[^\s/?#]+/i.test(trimmed)) return null;
  return trimmed;
}

/**
 * Staging and production talk to the backend over TLS only; a plain-http URL is treated as not
 * configured. Development allows http for a local backend on the LAN or emulator.
 */
function parseEndpoint(
  value: string | undefined,
  env: AppEnvironment,
  secureSchemes: readonly string[],
): string {
  const url = trimTrailingSlash(value?.trim() ?? '');
  if (!url || env === 'development') return url;
  return secureSchemes.some((scheme) => url.toLowerCase().startsWith(scheme)) ? url : '';
}

type RawEnv = {
  EXPO_PUBLIC_ENV?: string;
  EXPO_PUBLIC_API_BASE_URL?: string;
  EXPO_PUBLIC_WS_URL?: string;
  EXPO_PUBLIC_SUPPORT_EMAIL?: string;
  EXPO_PUBLIC_SUPPORT_PHONE?: string;
  EXPO_PUBLIC_PRIVACY_POLICY_URL?: string;
  EXPO_PUBLIC_TERMS_URL?: string;
  EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?: string;
  EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID?: string;
  EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?: string;
  EXPO_PUBLIC_SHARE_BASE_URL?: string;
  EXPO_PUBLIC_ANDROID_STORE_URL?: string;
  EXPO_PUBLIC_IOS_STORE_URL?: string;
};

const DEFAULT_ANDROID_STORE =
  'https://play.google.com/store/apps/details?id=com.palpeer.app';

function parseOptionalId(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

export function buildConfig(raw: RawEnv): AppConfig {
  const env = parseEnvironment(raw.EXPO_PUBLIC_ENV);
  return {
    env,
    apiBaseUrl: parseEndpoint(raw.EXPO_PUBLIC_API_BASE_URL, env, ['https://']),
    wsUrl: parseEndpoint(raw.EXPO_PUBLIC_WS_URL, env, ['https://', 'wss://']),
    // Staging/production often hit a cold Render free instance; keep headroom beyond 15s.
    requestTimeoutMs: env === 'development' ? 15_000 : 60_000,
    sessionRestoreTimeoutMs: 8_000,
    support: {
      email: parseEmail(raw.EXPO_PUBLIC_SUPPORT_EMAIL) ?? 'support@palpeer.com',
      phone: parsePhone(raw.EXPO_PUBLIC_SUPPORT_PHONE),
      privacyPolicyUrl: parseHttpsUrl(raw.EXPO_PUBLIC_PRIVACY_POLICY_URL),
      termsUrl: parseHttpsUrl(raw.EXPO_PUBLIC_TERMS_URL),
    },
    google: {
      webClientId: parseOptionalId(raw.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID),
      androidClientId: parseOptionalId(raw.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID),
      iosClientId: parseOptionalId(raw.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID),
    },
    share: {
      baseUrl: parseHttpsUrl(raw.EXPO_PUBLIC_SHARE_BASE_URL),
      androidStoreUrl: parseHttpsUrl(raw.EXPO_PUBLIC_ANDROID_STORE_URL) ?? DEFAULT_ANDROID_STORE,
      iosStoreUrl: parseHttpsUrl(raw.EXPO_PUBLIC_IOS_STORE_URL),
    },
  };
}

/**
 * Android emulator maps the host machine to 10.0.2.2; browsers cannot reach that address.
 * On web, rewrite it to localhost so the same .env.development works for Expo web preview.
 */
export function rewriteEmulatorHostForWeb(url: string, platform: string = Platform.OS): string {
  if (platform !== 'web' || !url) return url;
  return url.replace(/\/\/10\.0\.2\.2(?=[:/]|$)/g, '//localhost');
}

// EXPO_PUBLIC_* values are inlined at build time, so each must be read with a static member access.
const rawConfig = buildConfig({
  EXPO_PUBLIC_ENV: process.env.EXPO_PUBLIC_ENV,
  EXPO_PUBLIC_API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL,
  EXPO_PUBLIC_WS_URL: process.env.EXPO_PUBLIC_WS_URL,
  EXPO_PUBLIC_SUPPORT_EMAIL: process.env.EXPO_PUBLIC_SUPPORT_EMAIL,
  EXPO_PUBLIC_SUPPORT_PHONE: process.env.EXPO_PUBLIC_SUPPORT_PHONE,
  EXPO_PUBLIC_PRIVACY_POLICY_URL: process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL,
  EXPO_PUBLIC_TERMS_URL: process.env.EXPO_PUBLIC_TERMS_URL,
  EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  EXPO_PUBLIC_SHARE_BASE_URL: process.env.EXPO_PUBLIC_SHARE_BASE_URL,
  EXPO_PUBLIC_ANDROID_STORE_URL: process.env.EXPO_PUBLIC_ANDROID_STORE_URL,
  EXPO_PUBLIC_IOS_STORE_URL: process.env.EXPO_PUBLIC_IOS_STORE_URL,
});

export const appConfig: AppConfig = {
  ...rawConfig,
  apiBaseUrl: rewriteEmulatorHostForWeb(rawConfig.apiBaseUrl),
  wsUrl: rewriteEmulatorHostForWeb(rawConfig.wsUrl),
};

export function isApiConfigured(config: AppConfig = appConfig): boolean {
  return config.apiBaseUrl.length > 0;
}
