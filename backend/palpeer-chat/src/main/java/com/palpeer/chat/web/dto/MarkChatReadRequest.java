package com.palpeer.chat.web.dto;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

/** The latest message in the room the caller has seen. */
public record MarkChatReadRequest(@NotNull UUID messageId) {
}
