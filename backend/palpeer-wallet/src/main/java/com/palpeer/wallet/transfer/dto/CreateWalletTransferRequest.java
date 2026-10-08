package com.palpeer.wallet.transfer.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.UUID;

public record CreateWalletTransferRequest(
        @NotNull UUID sourceWalletId,
        /** Recipient email or E.164 phone. */
        @NotBlank @Size(max = 255) String recipient,
        @NotNull @DecimalMin(value = "0.000000000001", inclusive = true) BigDecimal amount,
        @Size(max = 500) String note
) {
}
