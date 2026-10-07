package com.palpeer.security.web.dto;

import jakarta.validation.constraints.NotBlank;

public record SecurityAnswerRequest(
        @NotBlank String questionKey,
        @NotBlank String answer
) {
}
