import * as Device from 'expo-device';
import { Platform } from 'react-native';

import { getDeviceIdentifier } from '@/services/biometrics/deviceRegistration';

/** Device fields attached to password / Google login so the API can enforce one active install. */
export async function deviceLoginPayload(): Promise<{
  deviceIdentifier: string;
  deviceName?: string;
  platform: string;
}> {
  const name = Device.deviceName ?? Device.modelName ?? undefined;
  return {
    deviceIdentifier: await getDeviceIdentifier(),
    deviceName: name ? name.slice(0, 120) : undefined,
    platform: Platform.OS,
  };
}
