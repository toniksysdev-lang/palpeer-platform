package com.palpeer.negotiation.domain;

/** Why a negotiation ended as CANCELLED. */
public enum NegotiationCloseReason {
    /** The participant whose turn it was declined the pending offer. */
    REJECTED,
    /** A participant withdrew from the negotiation. */
    CANCELLED,
    /** The P2P request stopped being OPEN (accepted, cancelled, expired or closed by an admin). */
    REQUEST_CLOSED
}
