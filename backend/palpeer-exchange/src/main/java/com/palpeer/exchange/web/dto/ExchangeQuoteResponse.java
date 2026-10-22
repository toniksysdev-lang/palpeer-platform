package com.palpeer.exchange.web.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record ExchangeQuoteResponse(
        UUID quoteId,
        UUID sourceWalletId,
        UUID targetWalletId,
        String sourceCurrencyCode,
        String targetCurrencyCode,
        BigDecimal sourceAmount,
        BigDecimal targetAmount,
        BigDecimal appliedRate,
        String rateSide,
        Instant expiresAt,
        String status,
        BigDecimal estimatedFeeAmount,
        String estimatedFeeCurrency
) {
}
