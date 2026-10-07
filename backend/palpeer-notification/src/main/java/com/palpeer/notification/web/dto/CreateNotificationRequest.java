package com.palpeer.notification.web.dto;

import com.palpeer.notification.domain.NotificationChannel;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.UUID;

/**
 * Internal/admin-facing create request.
 * CONTRACT_PENDING (P12-06): who may create notifications (system only vs admin).
 */
public record CreateNotificationRequest(
        @NotBlank @Size(max = 200) String title,
        @NotBlank @Size(max = 2000) String body,
        @Size(max = 80) String category,
        @NotNull NotificationChannel channel,
        @Size(max = 80) String referenceType,
        UUID referenceId
) {
}
