package com.palpeer.p2p.domain;

/**
 * Shared lifecycle for P2P requests and orders — verified Phase 8 catalog.
 */
public enum P2PStatus {
    OPEN,
    ACCEPTED,
    COMPLETED,
    EXPIRED,
    CANCELLED
}
