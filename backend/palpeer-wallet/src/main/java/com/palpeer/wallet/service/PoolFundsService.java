package com.palpeer.wallet.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.palpeer.wallet.funding.FundingTransactionRepository;
import com.palpeer.wallet.funding.MoneyMovementStatus;
import com.palpeer.wallet.provider.apaylo.ApayloClient;
import com.palpeer.wallet.provider.apaylo.ApayloPaymentRail;
import com.palpeer.wallet.provider.korapay.KorapayClient;
import com.palpeer.wallet.provider.korapay.KorapayPaymentRail;
import com.palpeer.wallet.provider.kuda.KudaClient;
import com.palpeer.wallet.provider.kuda.KudaPaymentRail;
import com.palpeer.wallet.repository.InstantExPoolContributionRepository;
import com.palpeer.wallet.web.dto.PoolFundsBalanceResponse;
import com.palpeer.wallet.web.dto.PoolFundsBalanceResponse.ProviderBalance;
import com.palpeer.wallet.withdrawal.WithdrawalTransactionRepository;
import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Pool funds = successful wallet funding − withdrawals ± InstantEX (booked),
 * with optional live provider settlement balances for reconciliation.
 *
 * <p>InstantEX: source currency is received into the pool; target currency is paid out.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PoolFundsService {

    private final ApayloClient apayloClient;
    private final KorapayClient korapayClient;
    private final KudaClient kudaClient;
    private final FundingTransactionRepository fundingTransactionRepository;
    private final WithdrawalTransactionRepository withdrawalTransactionRepository;
    private final InstantExPoolContributionRepository instantExPoolContributionRepository;

    @Transactional(readOnly = true)
    public ProviderBalance findProviderBalance(String provider, String currencyCode) {
        String p = provider == null ? "" : provider.trim().toUpperCase(Locale.ROOT);
        String c = currencyCode == null ? "" : currencyCode.trim().toUpperCase(Locale.ROOT);
        PoolFundsBalanceResponse all = balances();
        for (ProviderBalance card : List.of(all.apaylo(), all.korapay(), all.kuda())) {
            if (card != null
                    && p.equalsIgnoreCase(card.provider())
                    && c.equalsIgnoreCase(card.currencyCode())) {
                return card;
            }
        }
        return null;
    }

    @Transactional(readOnly = true)
    public PoolFundsBalanceResponse balances() {
        Map<String, BigDecimal> funded = aggregate(
                fundingTransactionRepository.sumAmountByProviderAndCurrency(MoneyMovementStatus.SUCCESS));
        Map<String, BigDecimal> withdrawn = aggregate(
                withdrawalTransactionRepository.sumAmountByProviderAndCurrency(MoneyMovementStatus.SUCCESS));
        Map<String, BigDecimal> instantExIn = aggregateByCurrency(
                instantExPoolContributionRepository.sumReceivedByCurrency());
        Map<String, BigDecimal> instantExOut = aggregateByCurrency(
                instantExPoolContributionRepository.sumPaidByCurrency());

        BigDecimal korapayLive = null;
        BigDecimal korapayPending = null;
        if (korapayClient.isConfigured()) {
            try {
                JsonNode ngn = korapayClient.getBalances().path("NGN");
                korapayLive = decimal(ngn, "available_balance", "availableBalance", "balance");
                korapayPending = decimal(ngn, "pending_balance", "pendingBalance");
            } catch (Exception ex) {
                log.warn("Korapay live pool balance lookup failed: {}", ex.getMessage());
            }
        }

        return new PoolFundsBalanceResponse(
                providerCard(
                        ApayloPaymentRail.NAME,
                        "CAD",
                        apayloClient.isConfigured(),
                        funded,
                        withdrawn,
                        instantExIn,
                        instantExOut,
                        liveApaylo(),
                        null),
                providerCard(
                        KorapayPaymentRail.NAME,
                        "NGN",
                        korapayClient.isConfigured(),
                        funded,
                        withdrawn,
                        instantExIn,
                        instantExOut,
                        korapayLive,
                        korapayPending),
                providerCard(
                        KudaPaymentRail.NAME,
                        "NGN",
                        kudaClient.isConfigured(),
                        funded,
                        withdrawn,
                        instantExIn,
                        instantExOut,
                        liveKuda(),
                        null));
    }

    private ProviderBalance providerCard(
            String provider,
            String currencyCode,
            boolean configured,
            Map<String, BigDecimal> funded,
            Map<String, BigDecimal> withdrawn,
            Map<String, BigDecimal> instantExIn,
            Map<String, BigDecimal> instantExOut,
            BigDecimal liveBalance,
            BigDecimal pendingBalance) {
        BigDecimal in = funded.getOrDefault(key(provider, currencyCode), BigDecimal.ZERO);
        BigDecimal out = withdrawn.getOrDefault(key(provider, currencyCode), BigDecimal.ZERO);
        // InstantEX attributed to the default rail for the currency (CAD→Apaylo, NGN→Korapay).
        // Kuda does not absorb InstantEX NGN (same rule as null-provider funding).
        BigDecimal received = BigDecimal.ZERO;
        BigDecimal paid = BigDecimal.ZERO;
        if (provider.equals(defaultProvider(currencyCode))) {
            received = instantExIn.getOrDefault(currencyCode, BigDecimal.ZERO);
            paid = instantExOut.getOrDefault(currencyCode, BigDecimal.ZERO);
        }
        // Live = provider settlement + funding − withdrawals + InstantEX in − InstantEX out
        BigDecimal adjustedLive = liveBalance == null
                ? null
                : liveBalance.add(in).subtract(out).add(received).subtract(paid);
        return ProviderBalance.booked(
                provider,
                currencyCode,
                configured,
                in,
                out,
                received,
                paid,
                adjustedLive,
                pendingBalance,
                null);
    }

    /**
     * Attribute activity to a provider rail. Null provider_name falls back by currency
     * (CAD→Apaylo, NGN→Korapay) so historical/sandbox rows still land in a pool.
     */
    private static Map<String, BigDecimal> aggregate(List<Object[]> rows) {
        Map<String, BigDecimal> totals = new HashMap<>();
        for (Object[] row : rows) {
            String provider = row[0] == null ? null : row[0].toString().trim().toUpperCase(Locale.ROOT);
            String currency = row[1] == null ? "" : row[1].toString().trim().toUpperCase(Locale.ROOT);
            BigDecimal amount = toAmount(row[2]);
            if (currency.isBlank() || amount.signum() == 0) {
                continue;
            }
            if (provider == null || provider.isBlank()) {
                provider = defaultProvider(currency);
            }
            if (provider == null) {
                continue;
            }
            String mapKey = key(provider, currency);
            totals.merge(mapKey, amount, BigDecimal::add);
        }
        return totals;
    }

    /** InstantEX rows are [currency, amount] — keyed by currency only. */
    private static Map<String, BigDecimal> aggregateByCurrency(List<Object[]> rows) {
        Map<String, BigDecimal> totals = new HashMap<>();
        for (Object[] row : rows) {
            String currency = row[0] == null ? "" : row[0].toString().trim().toUpperCase(Locale.ROOT);
            BigDecimal amount = toAmount(row[1]);
            if (currency.isBlank() || amount.signum() == 0) {
                continue;
            }
            totals.merge(currency, amount, BigDecimal::add);
        }
        return totals;
    }

    private static String defaultProvider(String currency) {
        return switch (currency) {
            case "CAD" -> ApayloPaymentRail.NAME;
            case "NGN" -> KorapayPaymentRail.NAME;
            default -> null;
        };
    }

    private static String key(String provider, String currency) {
        return provider + "|" + currency;
    }

    private static BigDecimal toAmount(Object value) {
        if (value == null) {
            return BigDecimal.ZERO;
        }
        if (value instanceof BigDecimal decimal) {
            return decimal;
        }
        if (value instanceof Number number) {
            return BigDecimal.valueOf(number.doubleValue());
        }
        try {
            return new BigDecimal(value.toString().trim());
        } catch (NumberFormatException ex) {
            return BigDecimal.ZERO;
        }
    }

    private BigDecimal liveApaylo() {
        if (!apayloClient.isConfigured()) {
            return null;
        }
        try {
            return apayloClient.getAccountBalance();
        } catch (Exception ex) {
            log.warn("Apaylo live pool balance lookup failed: {}", ex.getMessage());
            return null;
        }
    }

    private BigDecimal liveKuda() {
        if (!kudaClient.isConfigured()) {
            return null;
        }
        try {
            return kudaClient.getMainAccountBalance();
        } catch (Exception ex) {
            log.warn("Kuda live pool balance lookup failed: {}", ex.getMessage());
            return null;
        }
    }

    private static BigDecimal decimal(JsonNode node, String... fields) {
        if (node == null || node.isMissingNode() || node.isNull()) {
            return null;
        }
        for (String field : fields) {
            JsonNode child = node.path(field);
            if (child.isMissingNode() || child.isNull()) {
                continue;
            }
            if (child.isNumber()) {
                return child.decimalValue();
            }
            String text = child.asText();
            if (text != null && !text.isBlank()) {
                try {
                    return new BigDecimal(text.trim());
                } catch (NumberFormatException ignored) {
                    // try next
                }
            }
        }
        return null;
    }
}
