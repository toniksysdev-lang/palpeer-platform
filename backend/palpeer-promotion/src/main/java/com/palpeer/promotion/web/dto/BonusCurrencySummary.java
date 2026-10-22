package com.palpeer.promotion.web.dto;

import java.math.BigDecimal;

/** Per-currency bonus totals for the caller's My bonuses screen. */
public record BonusCurrencySummary(
        String currencyCode,
        BigDecimal totalAmount,
        /** PENDING — not yet credited / not yet consumed. */
        BigDecimal unusedAmount,
        /** GRANTED (wallet credit) + CANCELLED (e.g. applied to P2P fee). */
        BigDecimal usedAmount) {}
