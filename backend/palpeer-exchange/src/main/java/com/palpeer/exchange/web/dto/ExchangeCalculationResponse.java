package com.palpeer.exchange.web.dto;

import java.math.BigDecimal;
import java.util.UUID;

public record ExchangeCalculationResponse(
        UUID sourceWalletId,
        UUID targetWalletId,
        String sourceCurrencyCode,
        String targetCurrencyCode,
        BigDecimal sourceAmount,
        BigDecimal targetAmount,
        BigDecimal appliedRate,
        String rateSide,
        BigDecimal estimatedFeeAmount,
        String estimatedFeeCurrency
) {
}
