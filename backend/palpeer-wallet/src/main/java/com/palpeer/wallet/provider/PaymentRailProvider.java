package com.palpeer.wallet.provider;

import java.math.BigDecimal;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * Currency-scoped funding / withdrawal rail.
 * CAD → Apaylo, NGN → Kuda (confirmed by product request).
 */
public interface PaymentRailProvider {

    String providerName();

    Set<String> supportedCurrencies();

    boolean isEnabled();

    FundingInitiation initiateFunding(FundingInitiationRequest request);

    WithdrawalInitiation initiateWithdrawal(WithdrawalInitiationRequest request);

    record FundingInitiationRequest(
            UUID userId,
            UUID walletId,
            UUID fundingTransactionId,
            String currencyCode,
            BigDecimal amount,
            String userEmail,
            String userPhone,
            String idempotencyKey,
            String customerFirstName,
            String customerLastName
    ) {
    }

    record FundingInitiation(
            String providerReference,
            String instructions,
            boolean pendingExternalSettlement
    ) {
    }

    record WithdrawalInitiationRequest(
            UUID userId,
            UUID walletId,
            UUID withdrawalTransactionId,
            String currencyCode,
            BigDecimal amount,
            String destinationReference,
            String userEmail,
            String idempotencyKey
    ) {
    }

    record WithdrawalInitiation(
            String providerReference,
            boolean pendingExternalSettlement
    ) {
    }

    default Optional<String> parseErrorHint() {
        return Optional.empty();
    }
}
