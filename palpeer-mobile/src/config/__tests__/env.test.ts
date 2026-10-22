import { buildConfig, isApiConfigured, rewriteEmulatorHostForWeb } from '../env';

describe('buildConfig', () => {
  it('trims trailing slashes and reads the environment', () => {
    const config = buildConfig({
      EXPO_PUBLIC_ENV: 'staging',
      EXPO_PUBLIC_API_BASE_URL: 'https://staging.example.com/api/v1/',
      EXPO_PUBLIC_WS_URL: 'wss://staging.example.com/ws/websocket//',
    });
    expect(config.env).toBe('staging');
    expect(config.apiBaseUrl).toBe('https://staging.example.com/api/v1');
    expect(config.wsUrl).toBe('wss://staging.example.com/ws/websocket');
  });

  it.each(['staging', 'production'])('refuses non-TLS endpoints in %s', (env) => {
    const config = buildConfig({
      EXPO_PUBLIC_ENV: env,
      EXPO_PUBLIC_API_BASE_URL: 'http://api.example.com/api/v1',
      EXPO_PUBLIC_WS_URL: 'ws://api.example.com/ws',
    });
    expect(config.apiBaseUrl).toBe('');
    expect(config.wsUrl).toBe('');
    expect(isApiConfigured(config)).toBe(false);
    expect(
      buildConfig({ EXPO_PUBLIC_ENV: env, EXPO_PUBLIC_WS_URL: 'https://api.example.com/ws' }).wsUrl,
    ).toBe('https://api.example.com/ws');
  });

  it('allows plain http in development for a local backend', () => {
    const config = buildConfig({
      EXPO_PUBLIC_ENV: 'development',
      EXPO_PUBLIC_API_BASE_URL: 'http://10.0.2.2:8085/api/v1',
      EXPO_PUBLIC_WS_URL: 'http://10.0.2.2:8085/ws',
    });
    expect(config.apiBaseUrl).toBe('http://10.0.2.2:8085/api/v1');
    expect(config.wsUrl).toBe('http://10.0.2.2:8085/ws');
  });

  it('falls back to development for unknown environments', () => {
    expect(buildConfig({ EXPO_PUBLIC_ENV: 'qa' }).env).toBe('development');
  });

  it('accepts well-formed support details and https legal links only', () => {
    const config = buildConfig({
      EXPO_PUBLIC_SUPPORT_EMAIL: ' help@palpeer.example ',
      EXPO_PUBLIC_SUPPORT_PHONE: '+44 20 7946 0000',
      EXPO_PUBLIC_PRIVACY_POLICY_URL: 'https://palpeer.example/privacy',
      EXPO_PUBLIC_TERMS_URL: 'https://palpeer.example/terms',
    });
    expect(config.support).toEqual({
      email: 'help@palpeer.example',
      phone: '+44 20 7946 0000',
      privacyPolicyUrl: 'https://palpeer.example/privacy',
      termsUrl: 'https://palpeer.example/terms',
    });
  });

  it('defaults support email and drops malformed optional support details', () => {
    expect(buildConfig({}).support).toEqual({
      email: 'support@palpeer.com',
      phone: null,
      privacyPolicyUrl: null,
      termsUrl: null,
    });
    expect(buildConfig({}).google).toEqual({
      webClientId: null,
      androidClientId: null,
      iosClientId: null,
    });
    expect(buildConfig({}).share).toEqual({
      baseUrl: null,
      androidStoreUrl: 'https://play.google.com/store/apps/details?id=com.palpeer.app',
      iosStoreUrl: null,
    });
    const config = buildConfig({
      EXPO_PUBLIC_SUPPORT_EMAIL: 'not-an-email',
      EXPO_PUBLIC_SUPPORT_PHONE: 'call us',
      EXPO_PUBLIC_PRIVACY_POLICY_URL: 'http://palpeer.example/privacy',
      EXPO_PUBLIC_TERMS_URL: 'javascript:alert(1)',
    });
    expect(config.support).toEqual({
      email: 'support@palpeer.com',
      phone: null,
      privacyPolicyUrl: null,
      termsUrl: null,
    });
  });

  it('keeps Google client IDs when supplied', () => {
    const config = buildConfig({
      EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: ' web.apps.googleusercontent.com ',
      EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID: 'android.apps.googleusercontent.com',
      EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: 'ios.apps.googleusercontent.com',
    });
    expect(config.google).toEqual({
      webClientId: 'web.apps.googleusercontent.com',
      androidClientId: 'android.apps.googleusercontent.com',
      iosClientId: 'ios.apps.googleusercontent.com',
    });
  });

  it('reports whether an API is reachable', () => {
    expect(isApiConfigured(buildConfig({}))).toBe(false);
    expect(
      isApiConfigured(buildConfig({ EXPO_PUBLIC_API_BASE_URL: 'http://10.0.2.2:8085/api/v1' })),
    ).toBe(true);
  });

  it('defaults the support chat API to app.palpeer.com.ng on native', () => {
    const { Platform } = require('react-native');
    const original = Platform.OS;
    Platform.OS = 'android';
    try {
      expect(buildConfig({}).supportChatApiBaseUrl).toBe('https://app.palpeer.com.ng/api');
      expect(
        buildConfig({
          EXPO_PUBLIC_SUPPORT_CHAT_API_BASE_URL: 'https://app.palpeer.com.ng/api/',
        }).supportChatApiBaseUrl,
      ).toBe('https://app.palpeer.com.ng/api');
    } finally {
      Platform.OS = original;
    }
  });

  it('uses the Metro same-origin proxy path on web to avoid CORS', () => {
    const { Platform } = require('react-native');
    const original = Platform.OS;
    Platform.OS = 'web';
    try {
      expect(buildConfig({}).supportChatApiBaseUrl).toBe('/support-chat-api');
    } finally {
      Platform.OS = original;
    }
  });

  it('rewrites Android emulator loopback to localhost for web preview', () => {
    expect(rewriteEmulatorHostForWeb('http://10.0.2.2:8085/api/v1', 'web')).toBe(
      'http://localhost:8085/api/v1',
    );
    expect(rewriteEmulatorHostForWeb('ws://10.0.2.2:8085/ws/websocket', 'web')).toBe(
      'ws://localhost:8085/ws/websocket',
    );
    expect(rewriteEmulatorHostForWeb('http://10.0.2.2:8085/api/v1', 'android')).toBe(
      'http://10.0.2.2:8085/api/v1',
    );
  });
});
