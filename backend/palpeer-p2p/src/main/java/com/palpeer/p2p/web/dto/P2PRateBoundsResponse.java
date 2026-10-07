package com.palpeer.p2p.web.dto;

import java.math.BigDecimal;
import java.util.UUID;

public record P2PRateBoundsResponse(
        UUID id,
        String baseCurrencyCode,
        String quoteCurrencyCode,
        BigDecimal minRate,
        BigDecimal maxRate
) {
}
