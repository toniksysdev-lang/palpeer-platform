package com.palpeer.negotiation.service;

import com.palpeer.negotiation.web.dto.NegotiationResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessageSendingOperations;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Pushes every committed negotiation change to both participants on their private STOMP queue
 * ({@code /user/queue/negotiations}). The STOMP principal name is the user id.
 */
@Component
@RequiredArgsConstructor
public class NegotiationRealtimePublisher {

    public static final String USER_DESTINATION = "/queue/negotiations";

    private final SimpMessageSendingOperations messagingTemplate;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onChanged(NegotiationChangedEvent event) {
        NegotiationResponse negotiation = event.negotiation();
        messagingTemplate.convertAndSendToUser(
                negotiation.requesterId().toString(), USER_DESTINATION, negotiation);
        messagingTemplate.convertAndSendToUser(
                negotiation.counterpartyId().toString(), USER_DESTINATION, negotiation);
    }
}
