package com.palpeer.transaction.web.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * Provisional summary aggregates.
 * CONTRACT_PENDING (P11-04): exact summary metrics / period defaults.
 */
public record TransactionSummaryResponse(
        Instant from,
        Instant to,
        long totalCount,
        Map<String, Long> countByType,
        Map<String, Long> countByStatus,
        List<CurrencyAmountTotal> successfulFundingByCurrency,
        List<CurrencyAmountTotal> successfulWithdrawalByCurrency,
        long successfulExchangeCount
) {
    public record CurrencyAmountTotal(String currencyCode, BigDecimal totalAmount, long count) {
    }
}
