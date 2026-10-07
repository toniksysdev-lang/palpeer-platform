package com.palpeer.card.provider;

import com.palpeer.card.domain.CardTransactionStatus;
import com.palpeer.card.domain.CardTransactionType;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * External card issuer / processor adapter.
 * CONTRACT_PENDING (P13-06): which vendor (Marqeta, Stripe Issuing, etc.) and auth model.
 */
public interface CardProvider {

    String providerName();

    ProviderCardIssueResult issueCard(ProviderCardIssueRequest request);

    void blockCard(String providerCardId);

    void unblockCard(String providerCardId);

    List<ProviderCardTransaction> listTransactions(String providerCardId);

    record ProviderCardIssueRequest(
            UUID userId,
            String currencyCode,
            String cardholderName
    ) {
    }

    record ProviderCardIssueResult(
            String providerCardId,
            String lastFour,
            String brand,
            Integer expiryMonth,
            Integer expiryYear
    ) {
    }

    record ProviderCardTransaction(
            String providerTransactionId,
            CardTransactionType entryType,
            CardTransactionStatus status,
            BigDecimal amount,
            String currencyCode,
            String merchantName,
            Instant occurredAt
    ) {
    }
}
