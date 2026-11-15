package com.palpeer.p2p.service;

import java.time.Instant;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Marks OPEN requests EXPIRED shortly after {@code expiresAt}, and notifies the offer owner
 * ~30 minutes before expiry (push + email). Each request is handled in its own transaction.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class P2PExpiryJob {

    private final P2PService p2PService;

    @Scheduled(
            initialDelayString = "${palpeer.p2p.expiry-sweep-ms:30000}",
            fixedDelayString = "${palpeer.p2p.expiry-sweep-ms:30000}")
    public void sweep() {
        Instant now = Instant.now();

        int reminded = 0;
        for (UUID requestId : p2PService.findOpenIdsNeedingExpiryReminder(now)) {
            try {
                if (p2PService.sendExpiryReminderIfDue(requestId)) {
                    reminded++;
                }
            } catch (RuntimeException ex) {
                log.warn("P2P expiry reminder failed for request {}", requestId, ex);
            }
        }
        if (reminded > 0) {
            log.info("P2P expiry reminder sent for {} request(s)", reminded);
        }

        int expired = 0;
        for (UUID requestId : p2PService.findExpiredOpenIds(now)) {
            try {
                if (p2PService.expireIfDue(requestId)) {
                    expired++;
                }
            } catch (RuntimeException ex) {
                log.warn("P2P expiry failed for request {}", requestId, ex);
            }
        }
        if (expired > 0) {
            log.info("P2P expiry sweep expired {} request(s)", expired);
        }
    }
}
