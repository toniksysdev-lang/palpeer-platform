package com.palpeer.chat.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SendChatMessageRequest(
        @NotBlank @Size(max = 4000) String content,
        @Size(max = 100) String clientMessageId
) {
}
