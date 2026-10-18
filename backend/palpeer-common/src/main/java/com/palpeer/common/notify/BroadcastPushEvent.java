package com.palpeer.common.notify;

import java.util.UUID;

/**
 * Push (and in-app) notification to every user after the publisher transaction commits.
 * {@code excludeUserId} skips the actor who triggered the broadcast when non-null.
 */
public record BroadcastPushEvent(
        UUID excludeUserId,
        String title,
        String body,
        String category,
        String referenceType,
        UUID referenceId) {
}
