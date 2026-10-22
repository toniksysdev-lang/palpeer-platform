package com.palpeer.promotion.service;

import com.palpeer.common.notify.UserQualifyingTradeCompletedEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Slf4j
@Component
@RequiredArgsConstructor
public class ReferrerBonusUnlockListener {

    private final PromotionService promotionService;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onInviteeQualifyingTrade(UserQualifyingTradeCompletedEvent event) {
        if (event == null || event.userId() == null) {
            return;
        }
        try {
            int granted = promotionService.grantPendingReferrerBonusesForInvitee(event.userId());
            if (granted > 0) {
                log.info(
                        "Granted {} pending referrer bonus(es) after invitee {} completed a qualifying trade",
                        granted,
                        event.userId());
            }
        } catch (Exception ex) {
            log.warn(
                    "Failed unlocking referrer bonuses for invitee {}: {}",
                    event.userId(),
                    ex.getMessage());
        }
    }
}
