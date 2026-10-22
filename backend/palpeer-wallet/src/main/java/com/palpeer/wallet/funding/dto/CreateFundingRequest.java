package com.palpeer.wallet.funding.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.UUID;

public record CreateFundingRequest(
        @NotNull UUID walletId,
        @NotNull @DecimalMin(value = "0", inclusive = false) BigDecimal amount,
        String providerReference,
        /** CAD Instant Interac — payer Interac email (required by Apaylo Link). */
        @Email @Size(max = 320) String interacEmail,
        @Size(max = 80) String interacFirstName,
        @Size(max = 80) String interacLastName
) {
    public CreateFundingRequest(UUID walletId, BigDecimal amount, String providerReference) {
        this(walletId, amount, providerReference, null, null, null);
    }
}
