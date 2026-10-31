package com.palpeer.wallet.provider.kuda;

import com.palpeer.wallet.funding.FundingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Settles PENDING Kuda fundings when Live webhooks are delayed/missing by polling
 * {@code DYNAMIC_COLLECTION_ACCOUNT_TSQ}.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "palpeer.kuda", name = "enabled", havingValue = "true")
public class KudaFundingReconcileJob {

    private final FundingService fundingService;

    @Scheduled(
            initialDelayString = "${palpeer.kuda.reconcile-initial-delay-ms:20000}",
            fixedDelayString = "${palpeer.kuda.reconcile-delay-ms:30000}")
    public void sweep() {
        try {
            int settled = fundingService.reconcilePendingKudaFundings(20);
            if (settled > 0) {
                log.info("Kuda funding reconcile settled {} pending funding(s)", settled);
            }
        } catch (RuntimeException ex) {
            log.warn("Kuda funding reconcile sweep failed: {}", ex.getMessage());
        }
    }
}
