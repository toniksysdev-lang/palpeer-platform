package com.palpeer.chat.web.dto;

import java.time.Instant;
import java.util.UUID;

/** Broadcast on {@code /topic/rooms.{roomId}.reads} when a participant's read marker advances. */
public record ChatReadReceiptResponse(UUID roomId, UUID userId, Instant lastReadAt) {
}
