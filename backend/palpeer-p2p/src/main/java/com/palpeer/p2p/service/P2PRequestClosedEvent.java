package com.palpeer.p2p.service;

import com.palpeer.p2p.domain.P2PStatus;
import java.util.UUID;

/**
 * A P2P request left OPEN (accepted, cancelled, expired, or closed by an admin). Published
 * synchronously inside the transaction that changed it, so listeners' writes commit or roll back
 * with that change.
 */
public record P2PRequestClosedEvent(UUID requestId, P2PStatus status) {
}
