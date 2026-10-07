package com.palpeer.security.web.dto;

import java.util.UUID;

public record SecurityQuestionResponse(
        UUID id,
        String questionKey,
        String questionText
) {
}
