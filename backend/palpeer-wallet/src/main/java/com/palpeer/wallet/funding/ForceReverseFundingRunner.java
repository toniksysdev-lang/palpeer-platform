package com.palpeer.wallet.funding;

import java.util.Arrays;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * One-shot ops repair: reverse SUCCESS fundings listed in
 * {@code PALPEER_FORCE_REVERSE_FUNDING_IDS} (comma-separated UUIDs). Clear the env var after use.
 */
@Slf4j
@Component
@Order(100)
@RequiredArgsConstructor
public class ForceReverseFundingRunner implements ApplicationRunner {

    private final FundingService fundingService;

    @Value("${palpeer.repair.force-reverse-funding-ids:}")
    private String forceReverseFundingIds;

    @Override
    public void run(ApplicationArguments args) {
        if (forceReverseFundingIds == null || forceReverseFundingIds.isBlank()) {
            return;
        }
        UUID system = new UUID(0L, 0L);
        for (String raw : forceReverseFundingIds.split(",")) {
            String id = raw.trim();
            if (id.isEmpty()) {
                continue;
            }
            try {
                UUID fundingId = UUID.fromString(id);
                FundingTransactionResponse after = fundingService.operatorReverse(system, fundingId);
                log.warn(
                        "Force-reversed funding {} → status={} (clear PALPEER_FORCE_REVERSE_FUNDING_IDS)",
                        fundingId,
                        after.status());
            } catch (Exception ex) {
                log.error("Force-reverse failed for funding {}: {}", id, ex.getMessage());
            }
        }
    }
}
