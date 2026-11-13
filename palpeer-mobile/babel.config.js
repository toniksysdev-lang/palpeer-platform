module.exports = function (api) {
  api.cache(true);
  return {
    // Do not set jsxImportSource: 'nativewind' — remapped Pressable drops
    // backgroundColor/border from function styles on Android Fabric (green CTAs vanished).
    // Keep nativewind/babel for any className usage; newui paints via StyleSheet objects.
    presets: ['babel-preset-expo', 'nativewind/babel'],
    // Must be listed last — required for globe / flag Reanimated worklets on web + native.
    plugins: ['react-native-reanimated/plugin'],
  };
};
