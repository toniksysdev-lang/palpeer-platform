package com.palpeer.notification.domain;

/**
 * Push token platform.
 * CONTRACT_PENDING (P12-01): exact platform catalog / provider mapping (FCM, APNs, web push).
 */
public enum DeviceTokenPlatform {
    IOS,
    ANDROID,
    WEB,
    OTHER
}
