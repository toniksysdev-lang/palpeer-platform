package com.palpeer.security.web.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;
import java.util.List;

public record ResetPinRequest(
        @NotEmpty @Valid List<SecurityAnswerRequest> answers,
        @NotBlank
        @Pattern(regexp = "\\d{4,8}", message = "PIN must be 4-8 digits (provisional P3-01)")
        String newPin
) {
}
