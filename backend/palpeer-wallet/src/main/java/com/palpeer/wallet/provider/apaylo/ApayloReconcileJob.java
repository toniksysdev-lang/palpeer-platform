package com.palpeer.wallet.provider.apaylo;

import com.palpeer.wallet.funding.FundingService;
import com.palpeer.wallet.withdrawal.WithdrawalService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Apaylo does not offer webhooks (FAQ). Poll Interac/EFT search endpoints every few minutes
 * so CAD funding and withdrawals settle when Apaylo reports completion.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "palpeer.apaylo", name = "enabled", havingValue = "true")
public class ApayloReconcileJob {

    private final FundingService fundingService;
    private final WithdrawalService withdrawalService;

    @Scheduled(
            initialDelayString = "${palpeer.apaylo.reconcile-initial-delay-ms:20000}",
            fixedDelayString = "${palpeer.apaylo.reconcile-delay-ms:180000}")
    public void sweep() {
        try {
            int settled = fundingService.reconcilePendingApayloFundings(20);
            if (settled > 0) {
                log.info("Apaylo funding reconcile settled {} pending funding(s)", settled);
            }
        } catch (RuntimeException ex) {
            log.warn("Apaylo funding reconcile sweep failed: {}", ex.getMessage());
        }
        try {
            int settled = withdrawalService.reconcilePendingApayloWithdrawals(20);
            if (settled > 0) {
                log.info("Apaylo withdrawal reconcile settled {} pending withdrawal(s)", settled);
            }
        } catch (RuntimeException ex) {
            log.warn("Apaylo withdrawal reconcile sweep failed: {}", ex.getMessage());
        }
    }
}
