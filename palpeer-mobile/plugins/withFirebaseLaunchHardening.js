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
    // Keep FCM auto-init ON — expo-notifications needs it to obtain Expo/device push tokens.
    // Disabling this caused "Couldn't enable push… notification credentials" on physical installs.
    ensureMetaData(application, 'firebase_messaging_auto_init_enabled', 'true');
    // Analytics stays off (privacy / crash surface); push does not depend on it.
    ensureMetaData(application, 'firebase_analytics_collection_enabled', 'false');
    ensureMetaData(application, 'google_analytics_adid_collection_enabled', 'false');
    return mod;
  });

module.exports = withFirebaseLaunchHardening;
