package com.palpeer.exchange.web.dto;

import com.palpeer.exchange.domain.InstantExFeeType;
import java.math.BigDecimal;
import java.util.UUID;

public record InstantExFeeTierResponse(
        UUID id,
        String baseCurrencyCode,
        String quoteCurrencyCode,
        InstantExFeeType feeType,
        BigDecimal feeValue,
        BigDecimal minAmount,
        BigDecimal maxAmount,
        boolean active
) {
}
