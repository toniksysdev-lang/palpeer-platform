package com.palpeer.wallet.web.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import java.math.BigDecimal;

public record AdminCreateWithdrawalRequest(
        @NotNull @DecimalMin(value = "0", inclusive = false) BigDecimal amount,
        String destinationReference,
        @NotBlank @Pattern(regexp = "\\d{6}", message = "Code must be 6 digits") String code
) {
}
