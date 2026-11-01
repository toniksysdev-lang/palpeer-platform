package com.palpeer.wallet.provider.kuda;

import com.palpeer.wallet.funding.FundingService;
import com.palpeer.wallet.withdrawal.WithdrawalService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Settles PENDING Kuda fundings/withdrawals when Live webhooks are delayed/missing by polling
 * {@code DYNAMIC_COLLECTION_ACCOUNT_TSQ} / {@code TRANSACTION_STATUS_QUERY}.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "palpeer.kuda", name = "enabled", havingValue = "true")
public class KudaFundingReconcileJob {

    private final FundingService fundingService;
    private final WithdrawalService withdrawalService;

    @Scheduled(
            initialDelayString = "${palpeer.kuda.reconcile-initial-delay-ms:10000}",
            fixedDelayString = "${palpeer.kuda.reconcile-delay-ms:10000}")
    public void sweep() {
        try {
            int settled = fundingService.reconcilePendingKudaFundings(20);
            if (settled > 0) {
                log.info("Kuda funding reconcile settled {} pending funding(s)", settled);
            }
        } catch (RuntimeException ex) {
            log.warn("Kuda funding reconcile sweep failed: {}", ex.getMessage());
        }
        try {
            int settled = withdrawalService.reconcilePendingKudaWithdrawals(20);
            if (settled > 0) {
                log.info("Kuda withdrawal reconcile settled {} pending withdrawal(s)", settled);
            }
        } catch (RuntimeException ex) {
            log.warn("Kuda withdrawal reconcile sweep failed: {}", ex.getMessage());
        }
    }
}
