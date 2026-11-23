import {
  isDeliverablePushToken,
  isExpoPushToken,
  isRawApnsDeviceToken,
} from '@/services/push/pushNotifications';

describe('push token helpers', () => {
  it('recognizes Expo tokens', () => {
    expect(isExpoPushToken('ExponentPushToken[abc]')).toBe(true);
    expect(isExpoPushToken('ExpoPushToken[abc]')).toBe(true);
    expect(isExpoPushToken('not-expo')).toBe(false);
  });

  it('recognizes raw APNs hex', () => {
    const apns = 'a1b2c3d4e5f60718293a4b5c6d7e8f90112233445566778899aabbccddeeff00';
    expect(isRawApnsDeviceToken(apns)).toBe(true);
    expect(isDeliverablePushToken(apns)).toBe(false);
  });

  it('accepts long native FCM tokens', () => {
    const fcm = 'd'.repeat(140) + ':APA91bExampleFcmRegistrationTokenValue';
    expect(isDeliverablePushToken(fcm)).toBe(true);
  });
});
