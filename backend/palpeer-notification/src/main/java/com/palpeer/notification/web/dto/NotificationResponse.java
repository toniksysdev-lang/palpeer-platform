package com.palpeer.notification.web.dto;

import com.palpeer.notification.domain.NotificationChannel;
import com.palpeer.notification.domain.NotificationStatus;
import java.time.Instant;
import java.util.UUID;

public record NotificationResponse(
        UUID id,
        String title,
        String body,
        String category,
        NotificationChannel channel,
        NotificationStatus status,
        String referenceType,
        UUID referenceId,
        Instant readAt,
        Instant sentAt,
        String failureReason,
        Instant createdAt
) {
}
