package com.palpeer.promotion.web.dto;

import java.math.BigDecimal;

/**
 * Loyalty points balance for the signed-in user.
 * Product rule: 100 points = CA$1; balance is unused (PENDING) CAD referral bonuses.
 */
public record LoyaltyPointsBalance(
        long balancePoints,
        BigDecimal balanceCad,
        long earnedPoints,
        long usedPoints,
        int pointsPerCad,
        String currencyCode
) {
}
