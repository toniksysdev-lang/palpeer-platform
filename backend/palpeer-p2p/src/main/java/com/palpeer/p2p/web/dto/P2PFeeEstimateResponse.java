package com.palpeer.p2p.web.dto;

import java.math.BigDecimal;

/** Preview of the platform fee the buyer would pay for a P2P amount on a pair. */
public record P2PFeeEstimateResponse(
        String baseCurrencyCode,
        String quoteCurrencyCode,
        BigDecimal amount,
        /** Gross platform fee before promotions / bonus credit. */
        BigDecimal estimatedFeeAmount,
        String estimatedFeeCurrency,
        /** Amount waived via promotion formula/bonus + PENDING bonus credit. */
        BigDecimal feeDiscountAmount,
        /** Net fee after discount (what the buyer is charged). */
        BigDecimal feeAfterDiscount,
        String appliedPromotionCode,
        BigDecimal pendingBonusCredit) {}
