package com.palpeer.negotiation.service;

import com.palpeer.negotiation.web.dto.NegotiationResponse;

/** Published inside the transaction that changed a negotiation; delivered to participants after commit. */
public record NegotiationChangedEvent(NegotiationResponse negotiation) {
}
