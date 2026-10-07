package com.palpeer.chat.web.dto;

import java.time.Instant;
import java.util.UUID;

public record ChatMessageResponse(
        UUID id,
        UUID roomId,
        UUID senderId,
        String content,
        String clientMessageId,
        Instant createdAt
) {
}
