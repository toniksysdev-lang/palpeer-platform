package com.palpeer.wallet.provider;

import java.math.BigDecimal;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * Currency-scoped funding / withdrawal rail.
 * CAD → Apaylo; NGN → Kuda (preferred) or Korapay.
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
            String customerLastName,
            String interacEmail,
            String interacFirstName,
            String interacLastName
    ) {
        public FundingInitiationRequest(
                UUID userId,
                UUID walletId,
                UUID fundingTransactionId,
                String currencyCode,
                BigDecimal amount,
                String userEmail,
                String userPhone,
                String idempotencyKey,
                String customerFirstName,
                String customerLastName) {
            this(
                    userId,
                    walletId,
                    fundingTransactionId,
                    currencyCode,
                    amount,
                    userEmail,
                    userPhone,
                    idempotencyKey,
                    customerFirstName,
                    customerLastName,
                    null,
                    null,
                    null);
        }
    }

    record FundingInitiation(
            String providerReference,
            String instructions,
            boolean pendingExternalSettlement,
            /** Optional bank-transfer destination for the payer (Kuda collection / VA). */
            CollectionAccount collectionAccount
    ) {
        public FundingInitiation(
                String providerReference, String instructions, boolean pendingExternalSettlement) {
            this(providerReference, instructions, pendingExternalSettlement, null);
        }
    }

    /** Structured transfer destination returned by a funding rail. */
    record CollectionAccount(
            String accountNumber,
            String accountName,
            String bankName,
            String bankCode,
            String trackingReference
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
            String idempotencyKey,
            String customerName
    ) {
        public WithdrawalInitiationRequest(
                UUID userId,
                UUID walletId,
                UUID withdrawalTransactionId,
                String currencyCode,
                BigDecimal amount,
                String destinationReference,
                String userEmail,
                String idempotencyKey) {
            this(
                    userId,
                    walletId,
                    withdrawalTransactionId,
                    currencyCode,
                    amount,
                    destinationReference,
                    userEmail,
                    idempotencyKey,
                    null);
        }
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
