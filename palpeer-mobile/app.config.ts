import type { ConfigContext, ExpoConfig } from 'expo/config';
import { withAndroidManifest, type ConfigPlugin } from 'expo/config-plugins';

const APP_ENV = process.env.EXPO_PUBLIC_ENV ?? 'development';

if (APP_ENV !== 'development') {
  const apiUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim() ?? '';
  const wsUrl = process.env.EXPO_PUBLIC_WS_URL?.trim() ?? '';
  if (!apiUrl) {
    throw new Error(`EXPO_PUBLIC_API_BASE_URL is required for ${APP_ENV} builds.`);
  }
  if (!/^https:\/\//i.test(apiUrl)) {
    throw new Error(`EXPO_PUBLIC_API_BASE_URL must use https for ${APP_ENV} builds.`);
  }
  if (wsUrl && !/^(https|wss):\/\//i.test(wsUrl)) {
    throw new Error(`EXPO_PUBLIC_WS_URL must use https or wss for ${APP_ENV} builds.`);
  }
}

const APP_ID = 'com.palpeer.app';

/**
 * Development builds talk to a local backend over http (emulator host 10.0.2.2 or the LAN), which
 * Android blocks in release variants. Staging and production keep the platform default (TLS only).
 */
const withDevelopmentCleartext: ConfigPlugin = (config) =>
  withAndroidManifest(config, (mod) => {
    const application = mod.modResults.manifest.application?.[0];
    if (application) application.$['android:usesCleartextTraffic'] = 'true';
    return mod;
  });

export default (context: ConfigContext): ExpoConfig => {
  const resolved = buildExpoConfig(context);
  return APP_ENV === 'development' ? withDevelopmentCleartext(resolved) : resolved;
};

const buildExpoConfig = ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: APP_ENV === 'production' ? 'PALPEER' : `PALPEER (${APP_ENV})`,
  slug: 'palpeer',
  version: '0.1.0',
  scheme: 'palpeer',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  ios: {
    bundleIdentifier: APP_ID,
    supportsTablet: false,
    infoPlist: {
      NSCameraUsageDescription:
        'PALPEER uses the camera to capture your identity document and selfie for verification.',
      NSPhotoLibraryUsageDescription:
        'PALPEER lets you choose a photo of your identity document from your library.',
      NSFaceIDUsageDescription: 'PALPEER uses Face ID to unlock the app quickly and securely.',
    },
  },
  android: {
    package: APP_ID,
    allowBackup: false,
    adaptiveIcon: {
      backgroundColor: '#E8F7F0',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    permissions: ['android.permission.CAMERA', 'android.permission.USE_BIOMETRIC'],
    blockedPermissions: [
      'android.permission.RECORD_AUDIO',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
      'android.permission.SYSTEM_ALERT_WINDOW',
    ],
    predictiveBackGestureEnabled: false,
  },
  web: {
    bundler: 'metro',
    favicon: './assets/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-font',
    'expo-secure-store',
    'expo-web-browser',
    [
      'expo-splash-screen',
      {
        image: './assets/splash-icon.png',
        imageWidth: 160,
        resizeMode: 'contain',
        backgroundColor: '#FFFFFF',
        dark: { backgroundColor: '#07140F' },
      },
    ],
    [
      'expo-camera',
      {
        cameraPermission:
          'PALPEER uses the camera to capture your identity document and selfie for verification.',
        microphonePermission: false,
        recordAudioAndroid: false,
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission:
          'PALPEER lets you choose a photo of your identity document from your library.',
        cameraPermission:
          'PALPEER uses the camera to capture your identity document and selfie for verification.',
        microphonePermission: false,
      },
    ],
    [
      'expo-local-authentication',
      { faceIDPermission: 'PALPEER uses Face ID to unlock the app quickly and securely.' },
    ],
    ['expo-notifications', { color: '#0E9F6E' }],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    appEnv: APP_ENV,
  },
});
