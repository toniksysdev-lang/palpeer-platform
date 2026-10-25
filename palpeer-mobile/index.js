// Must be first — RNGH requires this before any other RN imports on Android.
import 'react-native-gesture-handler';
// Hold native splash before expo-router boots (avoids a blank / "Bundling…" frame).
import './src/boot/preventSplashAutoHide';
import 'expo-router/entry';
