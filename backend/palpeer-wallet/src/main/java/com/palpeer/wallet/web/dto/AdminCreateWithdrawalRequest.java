package com.palpeer.wallet.web.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

public record AdminCreateWithdrawalRequest(
        @NotNull @DecimalMin(value = "0", inclusive = false) BigDecimal amount,
        String destinationReference
) {
}
