package com.palpeer.negotiation.service;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;

import com.palpeer.negotiation.domain.NegotiationStatus;
import com.palpeer.negotiation.web.dto.NegotiationResponse;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessageSendingOperations;

@ExtendWith(MockitoExtension.class)
class NegotiationRealtimePublisherTest {

    @Mock private SimpMessageSendingOperations messagingTemplate;

    @InjectMocks private NegotiationRealtimePublisher publisher;

    @Test
    void sendsChangeToBothParticipantQueues() {
        UUID ownerId = UUID.randomUUID();
        UUID counterpartyId = UUID.randomUUID();
        NegotiationResponse negotiation = new NegotiationResponse(
                UUID.randomUUID(), UUID.randomUUID(), ownerId, counterpartyId,
                NegotiationStatus.OPEN, null, List.of(), Instant.now(), null, null, null);

        publisher.onChanged(new NegotiationChangedEvent(negotiation));

        verify(messagingTemplate).convertAndSendToUser(ownerId.toString(), "/queue/negotiations", negotiation);
        verify(messagingTemplate).convertAndSendToUser(counterpartyId.toString(), "/queue/negotiations", negotiation);
        verifyNoMoreInteractions(messagingTemplate);
    }
}
