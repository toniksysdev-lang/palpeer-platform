package com.palpeer.wallet.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateWalletRequest(
        @NotBlank @Size(min = 3, max = 10) String currencyCode
) {
}
