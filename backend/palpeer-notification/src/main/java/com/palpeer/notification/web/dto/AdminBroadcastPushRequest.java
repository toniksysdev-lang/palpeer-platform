package com.palpeer.notification.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Admin request to push a message to every app user.
 */
public record AdminBroadcastPushRequest(
        @NotBlank @Size(max = 200) String title,
        @NotBlank @Size(max = 2000) String body,
        @Size(max = 80) String category
) {
}
