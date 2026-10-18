package com.palpeer.wallet.web.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record WithdrawalUnverifiedLimitResponse(
        UUID id,
        String currencyCode,
        BigDecimal maxAmount,
        Instant updatedAt) {}
