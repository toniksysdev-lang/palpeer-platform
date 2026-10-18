package com.palpeer.wallet.web.dto;

import java.math.BigDecimal;

/**
 * Pool funds for admin Treasury.
 * {@code balance} is booked: funding − withdrawals + InstantEX received − InstantEX paid.
 * {@code liveBalance} is provider settlement adjusted by the same booked movements
 * (sandbox rails often do not move with wallet/InstantEX activity).
 */
public record PoolFundsBalanceResponse(
        ProviderBalance apaylo, ProviderBalance korapay, ProviderBalance kuda) {

    public record ProviderBalance(
            String provider,
            String currencyCode,
            boolean configured,
            boolean available,
            BigDecimal balance,
            BigDecimal pendingBalance,
            BigDecimal liveBalance,
            BigDecimal fundedTotal,
            BigDecimal withdrawnTotal,
            BigDecimal instantExReceivedTotal,
            BigDecimal instantExPaidTotal,
            String message) {

        public static ProviderBalance booked(
                String provider,
                String currencyCode,
                boolean providerConfigured,
                BigDecimal fundedTotal,
                BigDecimal withdrawnTotal,
                BigDecimal instantExReceivedTotal,
                BigDecimal instantExPaidTotal,
                BigDecimal liveBalance,
                BigDecimal pendingBalance,
                String message) {
            BigDecimal funded = fundedTotal == null ? BigDecimal.ZERO : fundedTotal;
            BigDecimal withdrawn = withdrawnTotal == null ? BigDecimal.ZERO : withdrawnTotal;
            BigDecimal received = instantExReceivedTotal == null ? BigDecimal.ZERO : instantExReceivedTotal;
            BigDecimal paid = instantExPaidTotal == null ? BigDecimal.ZERO : instantExPaidTotal;
            BigDecimal net = funded.subtract(withdrawn).add(received).subtract(paid);
            return new ProviderBalance(
                    provider,
                    currencyCode,
                    providerConfigured,
                    true,
                    net,
                    pendingBalance,
                    liveBalance,
                    funded,
                    withdrawn,
                    received,
                    paid,
                    message);
        }
    }
}
