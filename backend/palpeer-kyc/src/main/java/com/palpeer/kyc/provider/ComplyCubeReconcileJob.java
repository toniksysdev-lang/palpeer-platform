package com.palpeer.kyc.provider;

import com.palpeer.kyc.service.KycService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Settles UNDER_REVIEW KYC cases when Live ComplyCube webhooks are delayed/missing by polling
 * check outcomes.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "palpeer.complycube", name = "enabled", havingValue = "true")
public class ComplyCubeReconcileJob {

    private final KycService kycService;

    @Scheduled(
            initialDelayString = "${palpeer.complycube.reconcile-initial-delay-ms:25000}",
            fixedDelayString = "${palpeer.complycube.reconcile-delay-ms:45000}")
    public void sweep() {
        try {
            int updated = kycService.reconcileUnderReviewProviderChecks(20);
            if (updated > 0) {
                log.info("ComplyCube KYC reconcile updated {} case(s)", updated);
            }
        } catch (RuntimeException ex) {
            log.warn("ComplyCube KYC reconcile sweep failed: {}", ex.getMessage());
        }
    }
}
