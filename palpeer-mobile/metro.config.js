const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const { enhanceSupportChatProxy } = require('./scripts/supportChatProxy.cjs');

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

// Apply NativeWind first, then wrap enhanceMiddleware so it is not dropped.
const withCss = withNativeWind(config, { input: './global.css' });

// Dev-only CORS proxy for Expo web. Skip on EAS / CI export:embed workers.
const onEasOrCi = Boolean(process.env.EAS_BUILD || process.env.CI);
if (!onEasOrCi) {
  const previousEnhance = withCss.server?.enhanceMiddleware;
  withCss.server = {
    ...withCss.server,
    enhanceMiddleware: (middleware, server) => {
      const base = previousEnhance ? previousEnhance(middleware, server) : middleware;
      return enhanceSupportChatProxy(base);
    },
  };
}

module.exports = withCss;
