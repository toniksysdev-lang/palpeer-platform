package com.palpeer.security.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SecurityQuestionInput(
        @NotBlank @Size(max = 120) String questionKey,
        @NotBlank @Size(max = 500) String questionText,
        @NotBlank @Size(min = 1, max = 200) String answer
) {
}
