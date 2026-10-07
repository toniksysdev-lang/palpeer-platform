package com.palpeer.security.web.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;

public record SetSecurityQuestionsRequest(
        @NotEmpty @Valid List<SecurityQuestionInput> questions
) {
}
