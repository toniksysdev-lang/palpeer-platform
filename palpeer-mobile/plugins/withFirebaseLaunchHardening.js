/**
 * Softens Firebase / FCM cold-start on devices with missing or broken Google Play Services,
 * and forces legacy JNI packaging so native libs extract correctly on OEM Android builds.
 *
 * @param {import('expo/config').ExpoConfig} config
 */
const {
  withAndroidManifest,
  AndroidConfig,
} = require('expo/config-plugins');

function ensureMetaData(application, name, value) {
  if (!application['meta-data']) application['meta-data'] = [];
  const existing = application['meta-data'].find((item) => item.$?.['android:name'] === name);
  if (existing) {
    existing.$['android:value'] = value;
    return;
  }
  application['meta-data'].push({
    $: {
      'android:name': name,
      'android:value': value,
    },
  });
}

const withFirebaseLaunchHardening = (config) =>
  withAndroidManifest(config, (mod) => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(mod.modResults);
    // Defer FCM auto-init until Play Services / Firebase is usable — avoids native kill on
    // Huawei and other devices without (or with broken) Google Play Services.
    ensureMetaData(application, 'firebase_messaging_auto_init_enabled', 'false');
    ensureMetaData(application, 'firebase_analytics_collection_enabled', 'false');
    ensureMetaData(application, 'google_analytics_adid_collection_enabled', 'false');
    return mod;
  });

module.exports = withFirebaseLaunchHardening;
