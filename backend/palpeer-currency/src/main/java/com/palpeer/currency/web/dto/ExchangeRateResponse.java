package com.palpeer.currency.web.dto;

import com.palpeer.currency.domain.RateApprovalStatus;
import com.palpeer.currency.domain.RateChannel;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record ExchangeRateResponse(
        UUID id,
        String baseCurrencyCode,
        String quoteCurrencyCode,
        RateChannel channel,
        boolean active,
        RateApprovalStatus approvalStatus,
        BigDecimal buyRate,
        BigDecimal sellRate,
        Instant effectiveDate
) {
}
