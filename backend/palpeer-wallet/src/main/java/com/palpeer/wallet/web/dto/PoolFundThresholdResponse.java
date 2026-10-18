package com.palpeer.wallet.web.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record PoolFundThresholdResponse(
        UUID id,
        String provider,
        String currencyCode,
        BigDecimal thresholdAmount,
        BigDecimal currentBalance,
        boolean thresholdHit,
        List<UUID> notifyAdminUserIds,
        List<String> notifyPhones,
        Instant updatedAt) {}
