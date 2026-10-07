package com.palpeer.chat.web.dto;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record CreateChatRoomRequest(
        @NotNull UUID p2pOrderId
) {
}
