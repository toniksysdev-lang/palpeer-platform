package com.palpeer.card.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public record IssueCardRequest(
        @NotBlank @Size(max = 10) String currencyCode,
        UUID walletId,
        @Size(max = 120) String cardholderName
) {
}
