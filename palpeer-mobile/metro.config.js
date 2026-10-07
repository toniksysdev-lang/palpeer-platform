const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Native `expo run:android` creates android/build with huge trees that stall Metro's crawler.
const blockList = [
  /[\\/]android[\\/]build[\\/].*/,
  /[\\/]android[\\/]\.gradle[\\/].*/,
  /[\\/]android[\\/]app[\\/]build[\\/].*/,
  /[\\/]\.gradle[\\/].*/,
];
config.resolver.blockList = blockList;
config.watcher = {
  ...config.watcher,
  additionalExts: config.watcher?.additionalExts,
  healthCheck: { enabled: false },
};

module.exports = withNativeWind(config, { input: './global.css' });
