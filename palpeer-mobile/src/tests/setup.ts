process.env.EXPO_PUBLIC_ENV = 'development';
process.env.EXPO_PUBLIC_API_BASE_URL = 'http://api.test/api/v1';
process.env.EXPO_PUBLIC_WS_URL = 'ws://api.test/ws/websocket';

jest.mock('expo-web-browser', () => require('./mocks/expoWebBrowser'));
jest.mock('expo-auth-session/providers/google', () => require('./mocks/expoAuthSessionGoogle'));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
    getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      store.delete(key);
    }),
    __reset: () => store.clear(),
  };
});

require('react-native-gesture-handler/jestSetup');

jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));

// Reanimated 4.5 + worklets 0.10: package setUpTests / mock pull native worklets APIs
// that are incomplete in Jest. Stub enough for UI that uses Animated / entering.
jest.mock('react-native-reanimated', () => {
  const ReactNative = require('react-native');
  const NOOP = () => undefined;
  const ID = (value: unknown) => value;
  const Animated = {
    View: ReactNative.View,
    Text: ReactNative.Text,
    Image: ReactNative.Image,
    ScrollView: ReactNative.ScrollView,
    FlatList: ReactNative.FlatList,
    createAnimatedComponent: (Component: unknown) => Component,
    addWhitelistedNativeProps: NOOP,
    addWhitelistedUIProps: NOOP,
  };
  const entering = {
    duration: () => entering,
    delay: () => entering,
    springify: () => entering,
    damping: () => entering,
    stiffness: () => entering,
    build: () => NOOP,
  };
  return {
    __esModule: true,
    default: Animated,
    ...Animated,
    FadeIn: entering,
    FadeInDown: entering,
    FadeOut: entering,
    ZoomIn: entering,
    ZoomOut: entering,
    SlideInDown: entering,
    SlideOutDown: entering,
    Easing: {
      linear: ID,
      ease: ID,
      quad: ID,
      cubic: ID,
      poly: () => ID,
      sin: ID,
      circle: ID,
      exp: ID,
      elastic: () => ID,
      back: () => ID,
      bounce: ID,
      bezier: () => ID,
      in: ID,
      out: ID,
      inOut: ID,
    },
    Extrapolation: { IDENTITY: 'identity', CLAMP: 'clamp', EXTEND: 'extend' },
    ReduceMotion: { System: 'system', Always: 'always', Never: 'never' },
    useSharedValue: (value: unknown) => ({ value }),
    useAnimatedStyle: (factory: () => unknown) => factory(),
    useAnimatedProps: (factory: () => unknown) => factory(),
    useDerivedValue: (factory: () => unknown) => ({ value: factory() }),
    useAnimatedRef: () => ({ current: null }),
    useAnimatedScrollHandler: () => NOOP,
    withTiming: ID,
    withSpring: ID,
    withDelay: (_ms: number, value: unknown) => value,
    withSequence: ID,
    withRepeat: ID,
    cancelAnimation: NOOP,
    runOnJS: (fn: (...args: unknown[]) => unknown) => fn,
    runOnUI: (fn: (...args: unknown[]) => unknown) => fn,
    interpolate: () => 0,
    interpolateColor: () => '#000000',
    measure: () => null,
    setUpTests: NOOP,
  };
});

jest.mock('lucide-react-native', () => require('./mocks/lucide'));

jest.mock('nativewind', () => ({ colorScheme: { set: jest.fn(), get: jest.fn() } }));

jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);

jest.mock('expo-camera', () => require('./mocks/media'));
jest.mock('expo-image-picker', () => require('./mocks/media'));
jest.mock('expo-image-manipulator', () => require('./mocks/media'));
jest.mock('expo-screen-capture', () => require('./mocks/media'));

jest.mock('expo-local-authentication', () => require('./mocks/localAuthentication'));

jest.mock('expo-device', () => ({
  deviceName: 'Test Phone',
  modelName: 'Pixel Test',
  isDevice: true,
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    easConfig: { projectId: '17c6c982-5228-447d-b4f2-11aafef55874' },
    expoConfig: {
      extra: { eas: { projectId: '17c6c982-5228-447d-b4f2-11aafef55874' } },
    },
  },
}));

jest.mock('expo-notifications', () => require('./mocks/notifications'));
jest.mock('expo-audio', () => require('./mocks/expoAudio'));

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(async () => undefined),
  getStringAsync: jest.fn(async () => ''),
}));

jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  hasServicesEnabledAsync: jest.fn(async () => true),
  requestForegroundPermissionsAsync: jest.fn(async () => ({
    status: 'granted',
    granted: true,
    canAskAgain: true,
  })),
  getCurrentPositionAsync: jest.fn(async () => ({
    coords: { latitude: 43.65, longitude: -79.38, accuracy: 10 },
  })),
  reverseGeocodeAsync: jest.fn(async () => [
    {
      streetNumber: '100',
      street: 'Queen St W',
      city: 'Toronto',
      region: 'Ontario',
      postalCode: 'M5H 2N2',
      country: 'Canada',
      isoCountryCode: 'CA',
      district: null,
      subregion: null,
      name: null,
    },
  ]),
}));

jest.mock('@react-native-community/datetimepicker', () => require('./mocks/datetimepicker'));

jest.mock('expo-crypto', () => {
  let counter = 0;
  return {
    randomUUID: () => {
      counter += 1;
      return `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`;
    },
  };
});

jest.mock('react-native-view-shot', () => require('./mocks/receiptExport'));
jest.mock('expo-sharing', () => require('./mocks/receiptExport'));
jest.mock('expo-print', () => require('./mocks/receiptExport'));
jest.mock('expo-file-system/legacy', () => require('./mocks/receiptExport'));
