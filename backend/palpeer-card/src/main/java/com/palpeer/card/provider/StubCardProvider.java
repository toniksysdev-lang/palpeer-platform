package com.palpeer.card.provider;

import java.util.List;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * Dev/stub card provider — no real issuer calls until P13-06 is confirmed.
 */
@Slf4j
@Component
public class StubCardProvider implements CardProvider {

    public static final String NAME = "STUB";

    @Override
    public String providerName() {
        return NAME;
    }

    @Override
    public ProviderCardIssueResult issueCard(ProviderCardIssueRequest request) {
        String providerCardId = "stub-card-" + UUID.randomUUID();
        String lastFour = String.format("%04d", ThreadLocalRandom.current().nextInt(0, 10000));
        log.info("STUB issueCard user={} currency={} providerCardId={} lastFour={}",
                request.userId(), request.currencyCode(), providerCardId, lastFour);
        return new ProviderCardIssueResult(providerCardId, lastFour, "VISA", 12, 2030);
    }

    @Override
    public void blockCard(String providerCardId) {
        log.info("STUB blockCard providerCardId={}", providerCardId);
    }

    @Override
    public void unblockCard(String providerCardId) {
        log.info("STUB unblockCard providerCardId={}", providerCardId);
    }

    @Override
    public List<ProviderCardTransaction> listTransactions(String providerCardId) {
        // Stub returns empty; real provider would page remote history
        return List.of();
    }
}
