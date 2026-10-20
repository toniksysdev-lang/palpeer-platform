package com.palpeer.chat.web.dto;

import java.time.Instant;
import java.util.UUID;

public record ChatRoomResponse(
        UUID id,
        UUID p2pOrderId,
        UUID negotiationId,
        UUID participantAId,
        UUID participantBId,
        Instant createdAt,
        Instant participantALastReadAt,
        Instant participantBLastReadAt,
        /** Messages from the other participant after the caller's last-read marker; 0 for admin views. */
        long unreadCount
) {
}
