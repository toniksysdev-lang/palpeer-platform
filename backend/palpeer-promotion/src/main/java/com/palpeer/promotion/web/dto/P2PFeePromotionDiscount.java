package com.palpeer.promotion.web.dto;

import java.math.BigDecimal;

/** How much of a P2P platform fee can be covered by promotions / pending bonus credit. */
public record P2PFeePromotionDiscount(
        BigDecimal originalFeeAmount,
        BigDecimal discountAmount,
        BigDecimal feeAfterDiscount,
        String estimatedFeeCurrency,
        String promotionCode,
        BigDecimal pendingBonusCredit,
        /** Portion of {@link #discountAmount()} from the active promotion formula/bonus (not wallet credit). */
        BigDecimal promotionOffset) {}
