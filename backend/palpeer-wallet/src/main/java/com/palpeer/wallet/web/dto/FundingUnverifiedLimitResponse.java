package com.palpeer.wallet.web.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record FundingUnverifiedLimitResponse(
        UUID id, String currencyCode, BigDecimal maxAmount, Instant updatedAt) {}
