package com.palpeer.app.admin.reports;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * Read-only aggregates for the admin dashboard/reports. No fee or revenue figures.
 * Users/KYC/cards/wallets (and p2p/referrals/bonuses) are all-time; transactions use [from, to].
 */
public record AdminReportSummaryResponse(
        Instant generatedAt,
        Instant from,
        Instant to,
        StatusCounts users,
        StatusCounts kyc,
        Wallets wallets,
        Transactions transactions,
        P2P p2p,
        ByStatus cards,
        ByStatus referrals,
        Bonuses bonuses
) {

    public record StatusCounts(long total, Map<String, Long> byStatus) {
    }

    public record ByStatus(Map<String, Long> byStatus) {
    }

    public record Wallets(long total, List<CurrencyBalance> balancesByCurrency) {
    }

    public record CurrencyBalance(
            String currencyCode, long walletCount, BigDecimal availableTotal, BigDecimal pendingTotal) {
    }

    public record Transactions(
            Map<String, Long> countsByType,
            Map<String, Long> countsByTypeAndStatus,
            List<SuccessVolume> successVolume) {
    }

    public record SuccessVolume(String type, String currencyCode, long count, BigDecimal amount) {
    }

    public record P2P(Map<String, Long> requestsByStatus, Map<String, Long> ordersByStatus) {
    }

    public record Bonuses(Map<String, Long> byStatus, List<StatusCurrencyAmount> amountByStatusAndCurrency) {
    }

    public record StatusCurrencyAmount(String status, String currencyCode, BigDecimal amount) {
    }
}
