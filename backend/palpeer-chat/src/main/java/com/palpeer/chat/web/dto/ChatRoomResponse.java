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
        Instant participantBLastReadAt
) {
}
