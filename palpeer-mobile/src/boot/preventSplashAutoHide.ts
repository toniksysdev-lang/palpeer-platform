import * as SplashScreen from 'expo-splash-screen';

/**
 * Keep the native splash up until BrandSplash has painted.
 * Imported from index.js before expo-router/entry so auto-hide cannot win the race
 * while the root layout (and its own preventAutoHide call) is still bundling.
 */
SplashScreen.preventAutoHideAsync().catch(() => undefined);
