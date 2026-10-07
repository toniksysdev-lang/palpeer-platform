package com.palpeer.p2p.web.dto;

import com.palpeer.p2p.domain.P2PFeeType;
import java.math.BigDecimal;
import java.util.UUID;

public record P2PFeeTierResponse(
        UUID id,
        String baseCurrencyCode,
        String quoteCurrencyCode,
        P2PFeeType feeType,
        BigDecimal feeValue,
        BigDecimal minAmount,
        BigDecimal maxAmount,
        boolean active
) {
}
