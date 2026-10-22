package com.palpeer.negotiation.service;

import com.palpeer.common.audit.AuditRecord;
import com.palpeer.common.audit.AuditRecorder;
import com.palpeer.common.exception.BusinessException;
import com.palpeer.common.exception.ResourceNotFoundException;
import com.palpeer.common.notify.UserNotifyEvent;
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
import jakarta.persistence.criteria.Predicate;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.event.EventListener;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class NegotiationService {

    private final NegotiationRepository negotiationRepository;
    private final NegotiationOfferRepository negotiationOfferRepository;
    private final P2PRequestRepository p2PRequestRepository;
    private final P2PService p2PService;
    private final ApplicationEventPublisher eventPublisher;
    private final AuditRecorder auditRecorder;

    /**
     * Start negotiation with an initial offer against an OPEN P2P request.
     */
    @Transactional
    public NegotiationResponse offer(UUID counterpartyId, CreateOfferRequest request) {
        P2PRequest p2p = p2PRequestRepository.findById(request.p2pRequestId())
                .orElseThrow(() -> new ResourceNotFoundException("P2P request not found"));
        if (p2p.getStatus() != P2PStatus.OPEN) {
            throw new BusinessException("P2P_NOT_OPEN", "P2P request is not open", HttpStatus.CONFLICT);
        }
        if (p2p.getUserId().equals(counterpartyId)) {
            throw new BusinessException(
                    "NEGOTIATION_SELF_OFFER",
                    "Request owner cannot open negotiation as counterparty",
                    HttpStatus.CONFLICT);
        }

        negotiationRepository
                .findByP2pRequestIdAndCounterpartyIdAndStatus(
                        p2p.getId(), counterpartyId, NegotiationStatus.OPEN)
                .ifPresent(existing -> {
                    throw new BusinessException(
                            "NEGOTIATION_EXISTS",
                            "Open negotiation already exists for this request",
                            HttpStatus.CONFLICT);
                });

        Negotiation negotiation = new Negotiation();
        negotiation.setP2pRequestId(p2p.getId());
        negotiation.setRequesterId(p2p.getUserId());
        negotiation.setCounterpartyId(counterpartyId);
        negotiation.setStatus(NegotiationStatus.OPEN);
        negotiationRepository.save(negotiation);

        NegotiationOffer offer = createOffer(
                negotiation.getId(),
                counterpartyId,
                NegotiationOfferType.OFFER,
                request.amount(),
                request.rate());
        negotiation.setCurrentOfferId(offer.getId());
        negotiationRepository.save(negotiation);
        notifyRequesterOfOffer(p2p, negotiation, request.amount(), request.rate());
        return changed(negotiation);
    }

    /** Email + in-app + push to the listing owner when a counterparty opens a negotiation. */
    private void notifyRequesterOfOffer(
            P2PRequest p2p, Negotiation negotiation, BigDecimal amount, BigDecimal rate) {
        String detail = formatAmount(amount)
                + " "
                + p2p.getBaseCurrencyCode()
                + " / "
                + p2p.getQuoteCurrencyCode()
                + " at rate "
                + formatAmount(rate);
        String side = p2p.getSide() != null ? p2p.getSide().name() : "P2P";
        eventPublisher.publishEvent(new UserNotifyEvent(
                negotiation.getRequesterId(),
                "New P2P negotiation offer",
                "Someone sent a negotiation on your P2P " + side + " request: " + detail + ".",
                "P2P",
                "NEGOTIATION",
                negotiation.getId(),
                true,
                true));
    }

    private static String formatAmount(BigDecimal amount) {
        return amount == null ? "0" : amount.stripTrailingZeros().toPlainString();
    }

    @Transactional
    public NegotiationResponse counter(UUID userId, UUID negotiationId, CounterOfferRequest request) {
        Negotiation negotiation = requireParticipantForUpdate(userId, negotiationId);
        assertOpen(negotiation);

        NegotiationOffer current = requireCurrentPendingOffer(negotiation);
        if (current.getOfferedBy().equals(userId)) {
            throw new BusinessException(
                    "NEGOTIATION_WAIT_TURN",
                    "Cannot counter your own pending offer",
                    HttpStatus.CONFLICT);
        }

        current.setStatus(NegotiationOfferStatus.SUPERSEDED);
        negotiationOfferRepository.save(current);

        NegotiationOffer counter = createOffer(
                negotiation.getId(),
                userId,
                NegotiationOfferType.COUNTER,
                request.amount(),
                request.rate());
        negotiation.setCurrentOfferId(counter.getId());
        negotiationRepository.save(negotiation);
        return changed(negotiation);
    }

    /**
     * Accept the current pending offer. The acceptor must not be the offer author.
     * Creates a P2P order with negotiated terms.
     */
    @Transactional
    public NegotiationResponse accept(UUID userId, UUID negotiationId) {
        // Lock order request -> negotiation, matching the request-closed path, to avoid deadlocks.
        UUID requestId = negotiationRepository.findRequestIdForParticipant(negotiationId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Negotiation not found"));
        p2PRequestRepository.findByIdForUpdate(requestId);
        Negotiation negotiation = requireParticipantForUpdate(userId, negotiationId);
        assertOpen(negotiation);

        NegotiationOffer current = requireCurrentPendingOffer(negotiation);
        if (current.getOfferedBy().equals(userId)) {
            throw new BusinessException(
                    "NEGOTIATION_CANNOT_ACCEPT_OWN",
                    "Cannot accept your own offer",
                    HttpStatus.CONFLICT);
        }

        current.setStatus(NegotiationOfferStatus.ACCEPTED);
        negotiationOfferRepository.save(current);
        // Marked ACCEPTED before the request closes, so the request-closed listener skips it.
        negotiation.setStatus(NegotiationStatus.ACCEPTED);
        negotiationRepository.save(negotiation);

        // Acceptor of the P2P order is always the counterparty (non-owner)
        UUID orderAcceptorId = negotiation.getCounterpartyId();
        P2POrderResponse order = p2PService.acceptWithTerms(
                orderAcceptorId,
                negotiation.getP2pRequestId(),
                current.getAmount(),
                current.getRate());

        negotiation.setP2pOrderId(order.id());
        negotiationRepository.save(negotiation);
        return changed(negotiation);
    }

    /**
     * Decline the current pending offer. Only the participant whose turn it is may reject; the
     * negotiation ends (CANCELLED, reason REJECTED).
     */
    @Transactional
    public NegotiationResponse reject(UUID userId, UUID negotiationId) {
        Negotiation negotiation = requireParticipantForUpdate(userId, negotiationId);
        assertOpen(negotiation);

        NegotiationOffer current = requireCurrentPendingOffer(negotiation);
        if (current.getOfferedBy().equals(userId)) {
            throw new BusinessException(
                    "NEGOTIATION_CANNOT_REJECT_OWN",
                    "Cannot reject your own offer",
                    HttpStatus.CONFLICT);
        }
        current.setStatus(NegotiationOfferStatus.REJECTED);
        negotiationOfferRepository.save(current);
        close(negotiation, NegotiationCloseReason.REJECTED, userId);
        return changed(negotiation);
    }

    /** Either participant may withdraw while OPEN; a pending offer becomes REJECTED. */
    @Transactional
    public NegotiationResponse cancel(UUID userId, UUID negotiationId) {
        Negotiation negotiation = requireParticipantForUpdate(userId, negotiationId);
        assertOpen(negotiation);
        rejectPendingOffer(negotiation);
        close(negotiation, NegotiationCloseReason.CANCELLED, userId);
        return changed(negotiation);
    }

    /**
     * The request left OPEN: its remaining OPEN negotiations can never be accepted, so they end
     * (CANCELLED, reason REQUEST_CLOSED). Runs inside the transaction that closed the request.
     */
    @EventListener
    public void onRequestClosed(P2PRequestClosedEvent event) {
        for (Negotiation negotiation : negotiationRepository.findByP2pRequestIdAndStatus(
                event.requestId(), NegotiationStatus.OPEN)) {
            if (negotiation.getStatus() != NegotiationStatus.OPEN) {
                continue;
            }
            rejectPendingOffer(negotiation);
            close(negotiation, NegotiationCloseReason.REQUEST_CLOSED, null);
            changed(negotiation);
        }
    }

    @Transactional(readOnly = true)
    public NegotiationResponse get(UUID userId, UUID negotiationId) {
        Negotiation negotiation = negotiationRepository.findByIdAndParticipant(negotiationId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Negotiation not found"));
        return toResponse(negotiation);
    }

    /**
     * Negotiations where the user is the request owner or the counterparty, newest first,
     * optionally limited to one P2P request.
     */
    @Transactional(readOnly = true)
    public List<NegotiationResponse> listMine(UUID userId, UUID p2pRequestId) {
        List<Negotiation> negotiations = p2pRequestId == null
                ? negotiationRepository.findByRequesterIdOrCounterpartyIdOrderByCreatedAtDesc(userId, userId)
                : negotiationRepository.findByP2pRequestIdOrderByCreatedAtDesc(p2pRequestId).stream()
                        .filter(n -> n.getRequesterId().equals(userId) || n.getCounterpartyId().equals(userId))
                        .toList();
        return negotiations.stream().map(this::toResponse).toList();
    }

    /** Admin inventory — no participant check. */
    @Transactional(readOnly = true)
    public Page<NegotiationResponse> adminList(UUID userId, NegotiationStatus status, Pageable pageable) {
        Specification<Negotiation> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (userId != null) {
                predicates.add(cb.or(
                        cb.equal(root.get("requesterId"), userId),
                        cb.equal(root.get("counterpartyId"), userId)));
            }
            if (status != null) {
                predicates.add(cb.equal(root.get("status"), status));
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };
        return negotiationRepository.findAll(spec, pageable).map(this::toResponse);
    }

    /** Admin inventory — no participant check. */
    @Transactional(readOnly = true)
    public NegotiationResponse adminGet(UUID negotiationId) {
        Negotiation negotiation = negotiationRepository.findById(negotiationId)
                .orElseThrow(() -> new ResourceNotFoundException("Negotiation not found"));
        return toResponse(negotiation);
    }

    /**
     * Admin force-cancel of an OPEN negotiation. Pending offer is rejected; chat stays readable
     * but participants can no longer counter/accept.
     */
    @Transactional
    public NegotiationResponse adminCancel(UUID negotiationId) {
        Negotiation negotiation = negotiationRepository
                .findByIdForUpdate(negotiationId)
                .orElseThrow(() -> new ResourceNotFoundException("Negotiation not found"));
        assertOpen(negotiation);
        rejectPendingOffer(negotiation);
        close(negotiation, NegotiationCloseReason.CANCELLED, null);
        auditRecorder.record(AuditRecord.builder("ADMIN_NEGOTIATION_CANCEL")
                .entity("Negotiation:" + negotiation.getId())
                .newValue("status=CANCELLED;p2pRequestId=" + negotiation.getP2pRequestId())
                .build());
        return changed(negotiation);
    }

    /**
     * Admin force-accept of the current pending offer (creates the P2P order as the counterparty).
     */
    @Transactional
    public NegotiationResponse adminAccept(UUID negotiationId) {
        UUID requestId = negotiationRepository
                .findById(negotiationId)
                .map(Negotiation::getP2pRequestId)
                .orElseThrow(() -> new ResourceNotFoundException("Negotiation not found"));
        p2PRequestRepository.findByIdForUpdate(requestId);
        Negotiation negotiation = negotiationRepository
                .findByIdForUpdate(negotiationId)
                .orElseThrow(() -> new ResourceNotFoundException("Negotiation not found"));
        assertOpen(negotiation);

        NegotiationOffer current = requireCurrentPendingOffer(negotiation);
        current.setStatus(NegotiationOfferStatus.ACCEPTED);
        negotiationOfferRepository.save(current);
        negotiation.setStatus(NegotiationStatus.ACCEPTED);
        negotiationRepository.save(negotiation);

        UUID orderAcceptorId = negotiation.getCounterpartyId();
        P2POrderResponse order = p2PService.acceptWithTerms(
                orderAcceptorId,
                negotiation.getP2pRequestId(),
                current.getAmount(),
                current.getRate());
        negotiation.setP2pOrderId(order.id());
        negotiationRepository.save(negotiation);
        auditRecorder.record(AuditRecord.builder("ADMIN_NEGOTIATION_ACCEPT")
                .entity("Negotiation:" + negotiation.getId())
                .newValue("status=ACCEPTED;p2pOrderId=" + order.id())
                .build());
        return changed(negotiation);
    }

    private NegotiationOffer createOffer(
            UUID negotiationId,
            UUID offeredBy,
            NegotiationOfferType type,
            java.math.BigDecimal amount,
            java.math.BigDecimal rate) {
        NegotiationOffer offer = new NegotiationOffer();
        offer.setNegotiationId(negotiationId);
        offer.setOfferedBy(offeredBy);
        offer.setOfferType(type);
        offer.setAmount(amount);
        offer.setRate(rate);
        offer.setStatus(NegotiationOfferStatus.PENDING);
        return negotiationOfferRepository.save(offer);
    }

    private void rejectPendingOffer(Negotiation negotiation) {
        if (negotiation.getCurrentOfferId() == null) {
            return;
        }
        negotiationOfferRepository
                .findByIdAndNegotiationId(negotiation.getCurrentOfferId(), negotiation.getId())
                .filter(offer -> offer.getStatus() == NegotiationOfferStatus.PENDING)
                .ifPresent(offer -> {
                    offer.setStatus(NegotiationOfferStatus.REJECTED);
                    negotiationOfferRepository.save(offer);
                });
    }

    private void close(Negotiation negotiation, NegotiationCloseReason reason, UUID closedBy) {
        negotiation.setStatus(NegotiationStatus.CANCELLED);
        negotiation.setClosedReason(reason);
        negotiation.setClosedBy(closedBy);
        negotiationRepository.save(negotiation);
    }

    /** Builds the response and queues it for both participants (sent after commit). */
    private NegotiationResponse changed(Negotiation negotiation) {
        NegotiationResponse response = toResponse(negotiation);
        eventPublisher.publishEvent(new NegotiationChangedEvent(response));
        return response;
    }

    private Negotiation requireParticipantForUpdate(UUID userId, UUID negotiationId) {
        Negotiation negotiation = negotiationRepository.findByIdForUpdate(negotiationId)
                .orElseThrow(() -> new ResourceNotFoundException("Negotiation not found"));
        if (!negotiation.getRequesterId().equals(userId)
                && !negotiation.getCounterpartyId().equals(userId)) {
            throw new ResourceNotFoundException("Negotiation not found");
        }
        return negotiation;
    }

    private void assertOpen(Negotiation negotiation) {
        if (negotiation.getStatus() != NegotiationStatus.OPEN) {
            throw new BusinessException(
                    "NEGOTIATION_NOT_OPEN",
                    "Negotiation is not open: " + negotiation.getStatus(),
                    HttpStatus.CONFLICT);
        }
    }

    private NegotiationOffer requireCurrentPendingOffer(Negotiation negotiation) {
        if (negotiation.getCurrentOfferId() == null) {
            throw new BusinessException("NEGOTIATION_NO_OFFER", "No current offer", HttpStatus.CONFLICT);
        }
        NegotiationOffer offer = negotiationOfferRepository
                .findByIdAndNegotiationId(negotiation.getCurrentOfferId(), negotiation.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Current offer not found"));
        if (offer.getStatus() != NegotiationOfferStatus.PENDING) {
            throw new BusinessException(
                    "NEGOTIATION_OFFER_NOT_PENDING",
                    "Current offer is not pending",
                    HttpStatus.CONFLICT);
        }
        return offer;
    }

    private NegotiationResponse toResponse(Negotiation negotiation) {
        List<NegotiationResponse.OfferResponse> offers = negotiationOfferRepository
                .findByNegotiationIdOrderByCreatedAtAsc(negotiation.getId())
                .stream()
                .map(o -> new NegotiationResponse.OfferResponse(
                        o.getId(),
                        o.getOfferedBy(),
                        o.getOfferType(),
                        o.getAmount(),
                        o.getRate(),
                        o.getStatus(),
                        o.getCreatedAt()))
                .toList();

        return new NegotiationResponse(
                negotiation.getId(),
                negotiation.getP2pRequestId(),
                negotiation.getRequesterId(),
                negotiation.getCounterpartyId(),
                negotiation.getStatus(),
                negotiation.getCurrentOfferId(),
                offers,
                negotiation.getCreatedAt(),
                negotiation.getP2pOrderId(),
                negotiation.getClosedReason(),
                negotiation.getClosedBy());
    }
}
