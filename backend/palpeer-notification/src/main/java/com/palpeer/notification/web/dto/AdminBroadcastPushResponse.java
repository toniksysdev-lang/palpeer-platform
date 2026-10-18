package com.palpeer.notification.web.dto;

/**
 * Result of an admin broadcast push.
 */
public record AdminBroadcastPushResponse(int recipientCount, String title) {
}
