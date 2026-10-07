package com.palpeer.wallet.withdrawal.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.util.UUID;

public record CreateWithdrawalRequest(
        @NotNull UUID walletId,
        @NotNull @DecimalMin(value = "0", inclusive = false) BigDecimal amount,
        String destinationReference
) {
}
