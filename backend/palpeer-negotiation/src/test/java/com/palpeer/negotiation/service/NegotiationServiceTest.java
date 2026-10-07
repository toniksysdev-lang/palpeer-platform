package com.palpeer.negotiation.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.palpeer.common.exception.BusinessException;
import com.palpeer.common.exception.ResourceNotFoundException;
import com.palpeer.negotiation.domain.Negotiation;
import com.palpeer.negotiation.domain.NegotiationCloseReason;
import com.palpeer.negotiation.domain.NegotiationOffer;
import com.palpeer.negotiation.domain.NegotiationOfferStatus;
import com.palpeer.negotiation.domain.NegotiationOfferType;
import com.palpeer.negotiation.domain.NegotiationStatus;
import com.palpeer.negotiation.repository.NegotiationOfferRepository;
import com.palpeer.negotiation.repository.NegotiationRepository;
import com.palpeer.negotiation.web.dto.CounterOfferRequest;
import com.palpeer.negotiation.web.dto.CreateOfferRequest;
import com.palpeer.negotiation.web.dto.NegotiationResponse;
import com.palpeer.p2p.domain.P2PRequest;
import com.palpeer.p2p.domain.P2PStatus;
import com.palpeer.p2p.repository.P2PRequestRepository;
import com.palpeer.p2p.service.P2PRequestClosedEvent;
import com.palpeer.p2p.service.P2PService;
import com.palpeer.p2p.web.dto.P2POrderResponse;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class NegotiationServiceTest {

    @Mock private NegotiationRepository negotiationRepository;
    @Mock private NegotiationOfferRepository negotiationOfferRepository;
    @Mock private P2PRequestRepository p2PRequestRepository;
    @Mock private P2PService p2PService;
    @Mock private org.springframework.context.ApplicationEventPublisher eventPublisher;

    @InjectMocks private NegotiationService negotiationService;

    private UUID ownerId;
    private UUID counterpartyId;
    private UUID requestId;

    @BeforeEach
    void setUp() {
        ownerId = UUID.randomUUID();
        counterpartyId = UUID.randomUUID();
        requestId = UUID.randomUUID();
    }

    @Test
    void offer_createsNegotiationAndPendingOffer() {
        P2PRequest p2p = openRequest();
        when(p2PRequestRepository.findById(requestId)).thenReturn(Optional.of(p2p));
        when(negotiationRepository.findByP2pRequestIdAndCounterpartyIdAndStatus(
                        requestId, counterpartyId, NegotiationStatus.OPEN))
                .thenReturn(Optional.empty());
        when(negotiationRepository.save(any(Negotiation.class))).thenAnswer(inv -> {
            Negotiation n = inv.getArgument(0);
            if (n.getId() == null) {
                n.setId(UUID.randomUUID());
            }
            return n;
        });
        when(negotiationOfferRepository.save(any(NegotiationOffer.class))).thenAnswer(inv -> {
            NegotiationOffer o = inv.getArgument(0);
            o.setId(UUID.randomUUID());
            return o;
        });
        when(negotiationOfferRepository.findByNegotiationIdOrderByCreatedAtAsc(any()))
                .thenReturn(List.of());

        NegotiationResponse response = negotiationService.offer(
                counterpartyId,
                new CreateOfferRequest(requestId, new BigDecimal("90.00"), new BigDecimal("1490.00")));

        assertThat(response.status()).isEqualTo(NegotiationStatus.OPEN);
        assertThat(response.requesterId()).isEqualTo(ownerId);
        assertThat(response.counterpartyId()).isEqualTo(counterpartyId);
    }

    @Test
    void counter_rejectsOwnPendingOffer() {
        Negotiation negotiation = openNegotiation();
        NegotiationOffer pending = pendingOffer(negotiation.getId(), counterpartyId, NegotiationOfferType.OFFER);
        negotiation.setCurrentOfferId(pending.getId());

        when(negotiationRepository.findByIdForUpdate(negotiation.getId())).thenReturn(Optional.of(negotiation));
        when(negotiationOfferRepository.findByIdAndNegotiationId(pending.getId(), negotiation.getId()))
                .thenReturn(Optional.of(pending));

        assertThatThrownBy(() -> negotiationService.counter(
                        counterpartyId,
                        negotiation.getId(),
                        new CounterOfferRequest(new BigDecimal("95.00"), new BigDecimal("1480.00"))))
                .isInstanceOf(BusinessException.class)
                .extracting("code")
                .isEqualTo("NEGOTIATION_WAIT_TURN");
    }

    @Test
    void accept_callsP2pWithNegotiatedTermsAndStoresOrderId() {
        Negotiation negotiation = openNegotiation();
        NegotiationOffer pending = pendingOffer(negotiation.getId(), counterpartyId, NegotiationOfferType.OFFER);
        negotiation.setCurrentOfferId(pending.getId());
        UUID orderId = UUID.randomUUID();

        when(negotiationRepository.findRequestIdForParticipant(negotiation.getId(), ownerId))
                .thenReturn(Optional.of(requestId));
        when(negotiationRepository.findByIdForUpdate(negotiation.getId())).thenReturn(Optional.of(negotiation));
        when(negotiationOfferRepository.findByIdAndNegotiationId(pending.getId(), negotiation.getId()))
                .thenReturn(Optional.of(pending));
        when(negotiationOfferRepository.save(any(NegotiationOffer.class))).thenAnswer(inv -> inv.getArgument(0));
        when(negotiationRepository.save(any(Negotiation.class))).thenAnswer(inv -> inv.getArgument(0));
        when(p2PService.acceptWithTerms(eq(counterpartyId), eq(requestId), any(), any())).thenAnswer(inv -> {
            // The request-closed listener runs inside this call; the negotiation must already be ACCEPTED.
            assertThat(negotiation.getStatus()).isEqualTo(NegotiationStatus.ACCEPTED);
            return new P2POrderResponse(
                    orderId, requestId, ownerId, counterpartyId,
                    pending.getAmount(), pending.getRate(), P2PStatus.ACCEPTED, null);
        });
        when(negotiationOfferRepository.findByNegotiationIdOrderByCreatedAtAsc(negotiation.getId()))
                .thenReturn(List.of(pending));

        NegotiationResponse response = negotiationService.accept(ownerId, negotiation.getId());

        assertThat(response.status()).isEqualTo(NegotiationStatus.ACCEPTED);
        assertThat(response.p2pOrderId()).isEqualTo(orderId);
        assertThat(response.closedReason()).isNull();
        assertThat(pending.getStatus()).isEqualTo(NegotiationOfferStatus.ACCEPTED);
        verify(p2PRequestRepository).findByIdForUpdate(requestId);
        verify(p2PService).acceptWithTerms(
                counterpartyId, requestId, pending.getAmount(), pending.getRate());
        verify(eventPublisher).publishEvent(new NegotiationChangedEvent(response));
    }

    @Test
    void accept_nonParticipantGetsNotFound() {
        UUID negotiationId = UUID.randomUUID();
        UUID stranger = UUID.randomUUID();
        when(negotiationRepository.findRequestIdForParticipant(negotiationId, stranger)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> negotiationService.accept(stranger, negotiationId))
                .isInstanceOf(ResourceNotFoundException.class);
        verifyNoInteractions(p2PService, eventPublisher);
    }

    @Test
    void reject_onMyTurnEndsNegotiation() {
        Negotiation negotiation = openNegotiation();
        NegotiationOffer pending = pendingOffer(negotiation.getId(), counterpartyId, NegotiationOfferType.OFFER);
        negotiation.setCurrentOfferId(pending.getId());
        stubLockedWithOffer(negotiation, pending);

        NegotiationResponse response = negotiationService.reject(ownerId, negotiation.getId());

        assertThat(pending.getStatus()).isEqualTo(NegotiationOfferStatus.REJECTED);
        assertThat(response.status()).isEqualTo(NegotiationStatus.CANCELLED);
        assertThat(response.closedReason()).isEqualTo(NegotiationCloseReason.REJECTED);
        assertThat(response.closedBy()).isEqualTo(ownerId);
        verify(eventPublisher).publishEvent(new NegotiationChangedEvent(response));
    }

    @Test
    void reject_ownPendingOfferIsRefused() {
        Negotiation negotiation = openNegotiation();
        NegotiationOffer pending = pendingOffer(negotiation.getId(), counterpartyId, NegotiationOfferType.OFFER);
        negotiation.setCurrentOfferId(pending.getId());
        when(negotiationRepository.findByIdForUpdate(negotiation.getId())).thenReturn(Optional.of(negotiation));
        when(negotiationOfferRepository.findByIdAndNegotiationId(pending.getId(), negotiation.getId()))
                .thenReturn(Optional.of(pending));

        assertThatThrownBy(() -> negotiationService.reject(counterpartyId, negotiation.getId()))
                .isInstanceOf(BusinessException.class)
                .extracting("code")
                .isEqualTo("NEGOTIATION_CANNOT_REJECT_OWN");
        assertThat(pending.getStatus()).isEqualTo(NegotiationOfferStatus.PENDING);
        assertThat(negotiation.getStatus()).isEqualTo(NegotiationStatus.OPEN);
        verifyNoInteractions(eventPublisher);
    }

    @Test
    void reject_closedNegotiationIsRefused() {
        Negotiation negotiation = openNegotiation();
        negotiation.setStatus(NegotiationStatus.CANCELLED);
        when(negotiationRepository.findByIdForUpdate(negotiation.getId())).thenReturn(Optional.of(negotiation));

        assertThatThrownBy(() -> negotiationService.reject(ownerId, negotiation.getId()))
                .isInstanceOf(BusinessException.class)
                .extracting("code")
                .isEqualTo("NEGOTIATION_NOT_OPEN");
    }

    @Test
    void cancel_byEitherParticipantRejectsPendingOffer() {
        for (UUID caller : List.of(ownerId, counterpartyId)) {
            Negotiation negotiation = openNegotiation();
            NegotiationOffer pending = pendingOffer(negotiation.getId(), counterpartyId, NegotiationOfferType.OFFER);
            negotiation.setCurrentOfferId(pending.getId());
            stubLockedWithOffer(negotiation, pending);

            NegotiationResponse response = negotiationService.cancel(caller, negotiation.getId());

            assertThat(pending.getStatus()).isEqualTo(NegotiationOfferStatus.REJECTED);
            assertThat(response.status()).isEqualTo(NegotiationStatus.CANCELLED);
            assertThat(response.closedReason()).isEqualTo(NegotiationCloseReason.CANCELLED);
            assertThat(response.closedBy()).isEqualTo(caller);
        }
    }

    @Test
    void cancel_strangerGetsNotFound() {
        Negotiation negotiation = openNegotiation();
        when(negotiationRepository.findByIdForUpdate(negotiation.getId())).thenReturn(Optional.of(negotiation));

        assertThatThrownBy(() -> negotiationService.cancel(UUID.randomUUID(), negotiation.getId()))
                .isInstanceOf(ResourceNotFoundException.class);
        assertThat(negotiation.getStatus()).isEqualTo(NegotiationStatus.OPEN);
    }

    @Test
    void onRequestClosed_cancelsOpenNegotiationsAndSkipsAccepted() {
        Negotiation open = openNegotiation();
        NegotiationOffer pending = pendingOffer(open.getId(), counterpartyId, NegotiationOfferType.OFFER);
        open.setCurrentOfferId(pending.getId());
        Negotiation accepting = openNegotiation();
        accepting.setStatus(NegotiationStatus.ACCEPTED);

        when(negotiationRepository.findByP2pRequestIdAndStatus(requestId, NegotiationStatus.OPEN))
                .thenReturn(List.of(open, accepting));
        when(negotiationOfferRepository.findByIdAndNegotiationId(pending.getId(), open.getId()))
                .thenReturn(Optional.of(pending));
        when(negotiationOfferRepository.save(any(NegotiationOffer.class))).thenAnswer(inv -> inv.getArgument(0));
        when(negotiationRepository.save(any(Negotiation.class))).thenAnswer(inv -> inv.getArgument(0));
        when(negotiationOfferRepository.findByNegotiationIdOrderByCreatedAtAsc(open.getId()))
                .thenReturn(List.of(pending));

        negotiationService.onRequestClosed(new P2PRequestClosedEvent(requestId, P2PStatus.CANCELLED));

        assertThat(open.getStatus()).isEqualTo(NegotiationStatus.CANCELLED);
        assertThat(open.getClosedReason()).isEqualTo(NegotiationCloseReason.REQUEST_CLOSED);
        assertThat(open.getClosedBy()).isNull();
        assertThat(pending.getStatus()).isEqualTo(NegotiationOfferStatus.REJECTED);
        assertThat(accepting.getStatus()).isEqualTo(NegotiationStatus.ACCEPTED);
        assertThat(accepting.getClosedReason()).isNull();
        verify(eventPublisher, times(1)).publishEvent(any(NegotiationChangedEvent.class));
    }

    @Test
    void counter_publishesChange() {
        Negotiation negotiation = openNegotiation();
        NegotiationOffer pending = pendingOffer(negotiation.getId(), counterpartyId, NegotiationOfferType.OFFER);
        negotiation.setCurrentOfferId(pending.getId());
        stubLockedWithOffer(negotiation, pending);
        when(negotiationOfferRepository.save(any(NegotiationOffer.class))).thenAnswer(inv -> {
            NegotiationOffer o = inv.getArgument(0);
            if (o.getId() == null) {
                o.setId(UUID.randomUUID());
            }
            return o;
        });

        NegotiationResponse response = negotiationService.counter(
                ownerId, negotiation.getId(), new CounterOfferRequest(new BigDecimal("95.00"), new BigDecimal("1480.00")));

        assertThat(pending.getStatus()).isEqualTo(NegotiationOfferStatus.SUPERSEDED);
        verify(eventPublisher).publishEvent(new NegotiationChangedEvent(response));
    }

    private void stubLockedWithOffer(Negotiation negotiation, NegotiationOffer pending) {
        when(negotiationRepository.findByIdForUpdate(negotiation.getId())).thenReturn(Optional.of(negotiation));
        when(negotiationOfferRepository.findByIdAndNegotiationId(pending.getId(), negotiation.getId()))
                .thenReturn(Optional.of(pending));
        lenient().when(negotiationOfferRepository.save(any(NegotiationOffer.class))).thenAnswer(inv -> inv.getArgument(0));
        when(negotiationRepository.save(any(Negotiation.class))).thenAnswer(inv -> inv.getArgument(0));
        lenient().when(negotiationOfferRepository.findByNegotiationIdOrderByCreatedAtAsc(negotiation.getId()))
                .thenReturn(List.of(pending));
    }

    @Test
    void listMine_returnsNegotiationsWhereUserParticipates() {
        Negotiation negotiation = openNegotiation();
        when(negotiationRepository.findByRequesterIdOrCounterpartyIdOrderByCreatedAtDesc(ownerId, ownerId))
                .thenReturn(List.of(negotiation));
        when(negotiationOfferRepository.findByNegotiationIdOrderByCreatedAtAsc(negotiation.getId()))
                .thenReturn(List.of(pendingOffer(negotiation.getId(), counterpartyId, NegotiationOfferType.OFFER)));

        List<NegotiationResponse> result = negotiationService.listMine(ownerId, null);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).id()).isEqualTo(negotiation.getId());
        assertThat(result.get(0).offers()).hasSize(1);
    }

    @Test
    void listMine_byRequestHidesOtherUsersNegotiations() {
        Negotiation mine = openNegotiation();
        Negotiation others = openNegotiation();
        others.setCounterpartyId(UUID.randomUUID());
        when(negotiationRepository.findByP2pRequestIdOrderByCreatedAtDesc(requestId))
                .thenReturn(List.of(mine, others));

        assertThat(negotiationService.listMine(counterpartyId, requestId))
                .extracting(NegotiationResponse::id)
                .containsExactly(mine.getId());
        assertThat(negotiationService.listMine(ownerId, requestId)).hasSize(2);
    }

    private P2PRequest openRequest() {
        P2PRequest request = new P2PRequest();
        request.setId(requestId);
        request.setUserId(ownerId);
        request.setStatus(P2PStatus.OPEN);
        return request;
    }

    private Negotiation openNegotiation() {
        Negotiation negotiation = new Negotiation();
        negotiation.setId(UUID.randomUUID());
        negotiation.setP2pRequestId(requestId);
        negotiation.setRequesterId(ownerId);
        negotiation.setCounterpartyId(counterpartyId);
        negotiation.setStatus(NegotiationStatus.OPEN);
        return negotiation;
    }

    private NegotiationOffer pendingOffer(UUID negotiationId, UUID offeredBy, NegotiationOfferType type) {
        NegotiationOffer offer = new NegotiationOffer();
        offer.setId(UUID.randomUUID());
        offer.setNegotiationId(negotiationId);
        offer.setOfferedBy(offeredBy);
        offer.setOfferType(type);
        offer.setAmount(new BigDecimal("90.00"));
        offer.setRate(new BigDecimal("1490.00"));
        offer.setStatus(NegotiationOfferStatus.PENDING);
        return offer;
    }
}
