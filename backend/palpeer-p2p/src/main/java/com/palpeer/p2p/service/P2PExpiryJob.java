package com.palpeer.p2p.service;

import java.time.Instant;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Marks OPEN requests EXPIRED shortly after {@code expiresAt}, so their negotiations close on time
 * instead of on the next read of the request. Each request expires in its own transaction.
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
        int expired = 0;
        for (UUID requestId : p2PService.findExpiredOpenIds(Instant.now())) {
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
