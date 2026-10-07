package com.palpeer.notification.domain;

/**
 * Delivery channel for a notification.
 * CONTRACT_PENDING (P12-02): which channels are required in v1.
 */
public enum NotificationChannel {
    IN_APP,
    PUSH,
    EMAIL,
    BOTH
}
