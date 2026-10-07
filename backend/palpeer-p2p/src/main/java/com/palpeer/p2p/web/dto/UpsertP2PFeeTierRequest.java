package com.palpeer.p2p.web.dto;

import com.palpeer.p2p.domain.P2PFeeType;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

public record UpsertP2PFeeTierRequest(
        @NotBlank @Size(min = 3, max = 10) String baseCurrencyCode,
        @NotBlank @Size(min = 3, max = 10) String quoteCurrencyCode,
        @NotNull P2PFeeType feeType,
        @NotNull @DecimalMin(value = "0", inclusive = false) BigDecimal feeValue,
        @NotNull @DecimalMin(value = "0", inclusive = true) BigDecimal minAmount,
        @DecimalMin(value = "0", inclusive = false) BigDecimal maxAmount,
        Boolean active
) {
}
