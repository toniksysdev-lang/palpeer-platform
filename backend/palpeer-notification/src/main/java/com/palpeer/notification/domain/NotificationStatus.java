package com.palpeer.notification.domain;

/**
 * Notification lifecycle status.
 * CONTRACT_PENDING (P12-03): definitive status catalog and transitions.
 */
public enum NotificationStatus {
    PENDING,
    SENT,
    FAILED,
    READ
}
