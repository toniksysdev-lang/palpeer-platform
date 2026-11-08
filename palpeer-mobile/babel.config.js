module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }], 'nativewind/babel'],
    // Must be listed last — required for globe / flag Reanimated worklets on web + native.
    plugins: ['react-native-reanimated/plugin'],
  };
};
