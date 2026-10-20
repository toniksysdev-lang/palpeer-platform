import fs from 'node:fs';
import path from 'node:path';

import type { ConfigContext, ExpoConfig } from 'expo/config';
import { withAndroidManifest, type ConfigPlugin } from 'expo/config-plugins';

const APP_ENV = process.env.EXPO_PUBLIC_ENV ?? 'development';

/** Prefer env override, then a local file checked into the machine (gitignored). */
function resolveGoogleServicesFile(...candidates: Array<string | undefined>): string | undefined {
  for (const candidate of candidates) {
    if (!candidate) continue;
    const resolved = path.isAbsolute(candidate) ? candidate : path.resolve(__dirname, candidate);
    if (fs.existsSync(resolved)) return resolved;
  }
  return undefined;
}

const androidGoogleServices = resolveGoogleServicesFile(
  process.env.GOOGLE_SERVICES_JSON,
  './google-services.json',
);
const iosGoogleServices = resolveGoogleServicesFile(
  process.env.GOOGLE_SERVICES_PLIST,
  './GoogleService-Info.plist',
);

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
  owner: 'toniksyslab',
  version: '0.1.4',
  scheme: 'palpeer',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  ios: {
    bundleIdentifier: APP_ID,
    supportsTablet: false,
    ...(iosGoogleServices ? { googleServicesFile: iosGoogleServices } : {}),
    associatedDomains: ['applinks:app.palpeer.com'],
    infoPlist: {
      NSCameraUsageDescription:
        'PALPEER uses the camera to capture your identity document and selfie for verification.',
      NSPhotoLibraryUsageDescription:
        'PALPEER lets you choose a photo of your identity document from your library.',
      NSFaceIDUsageDescription: 'PALPEER uses Face ID to unlock the app quickly and securely.',
      NSLocationWhenInUseUsageDescription:
        'PALPEER uses your location to fill in your residential address on the personal information form.',
      ITSAppUsesNonExemptEncryption: false,
      // Only when Firebase/APNs credentials ship with the build — otherwise cold start can crash.
      ...(iosGoogleServices ? { UIBackgroundModes: ['remote-notification'] } : {}),
    },
  },
  android: {
    package: APP_ID,
    allowBackup: false,
    ...(androidGoogleServices ? { googleServicesFile: androidGoogleServices } : {}),
    adaptiveIcon: {
      backgroundColor: '#FFFFFF',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    permissions: [
      'android.permission.CAMERA',
      'android.permission.USE_BIOMETRIC',
      'android.permission.ACCESS_COARSE_LOCATION',
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.POST_NOTIFICATIONS',
    ],
    blockedPermissions: [
      'android.permission.RECORD_AUDIO',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
      'android.permission.SYSTEM_ALERT_WINDOW',
    ],
    predictiveBackGestureEnabled: false,
    // HTTPS share links open the app when installed; otherwise the browser shows store CTAs.
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        category: ['BROWSABLE', 'DEFAULT'],
        data: [
          {
            scheme: 'https',
            host: 'app.palpeer.com',
            pathPrefix: '/p2p/share',
          },
        ],
      },
    ],
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
      'expo-build-properties',
      {
        android: {
          // Extract .so files at install time — fixes SoLoader crashes on some OEM devices.
          useLegacyPackaging: true,
          // Keep both 32-bit and 64-bit ARM (plus emulator ABIs via EAS defaults).
          buildArchs: ['armeabi-v7a', 'arm64-v8a'],
          minSdkVersion: 24,
        },
      },
    ],
    './plugins/withFirebaseLaunchHardening',
    [
      'expo-splash-screen',
      {
        image: './assets/splash-icon.png',
        imageWidth: 200,
        resizeMode: 'contain',
        backgroundColor: '#FFFFFF',
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
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'PALPEER uses your location to fill in your residential address on the personal information form.',
      },
    ],
    '@react-native-community/datetimepicker',
    [
      'expo-notifications',
      {
        color: '#0E9F6E',
        defaultChannel: 'palpeer_default',
        // Requires google-services / GoogleService-Info in the binary. Without them, enabling
        // background remote notifications can native-crash the Android/iOS process on launch.
        enableBackgroundRemoteNotifications: Boolean(androidGoogleServices || iosGoogleServices),
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    appEnv: APP_ENV,
    eas: {
      projectId: '17c6c982-5228-447d-b4f2-11aafef55874',
    },
  },
});
