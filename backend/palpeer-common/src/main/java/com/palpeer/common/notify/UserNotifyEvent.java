package com.palpeer.common.notify;

import java.util.UUID;

/**
 * Request to notify a single user after the publisher transaction commits.
 * Consumed by the notification module (email and/or push + in-app record).
 */
public record UserNotifyEvent(
        UUID userId,
        String title,
        String body,
        String category,
        String referenceType,
        UUID referenceId,
        boolean sendEmail,
        boolean sendPush) {
}
