package com.palpeer.p2p.service;

import com.palpeer.common.audit.AuditRecord;
import com.palpeer.common.audit.AuditRecorder;
import com.palpeer.common.exception.BusinessException;
import com.palpeer.common.exception.ResourceNotFoundException;
import com.palpeer.currency.service.CurrencyService;
import com.palpeer.p2p.domain.P2POrder;
import com.palpeer.p2p.domain.P2PRequest;
import com.palpeer.p2p.domain.P2PStatus;
import com.palpeer.p2p.repository.P2POrderRepository;
import com.palpeer.p2p.repository.P2PRequestRepository;
import com.palpeer.p2p.web.dto.CreateP2PRequestDto;
import com.palpeer.p2p.web.dto.P2POrderResponse;
import com.palpeer.p2p.web.dto.P2POrderSummaryResponse;
import com.palpeer.p2p.web.dto.P2PRequestResponse;
import com.palpeer.p2p.web.dto.PublicP2PRateResponse;
import com.palpeer.p2p.web.dto.UpdateP2PRequestDto;
import jakarta.persistence.criteria.Predicate;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class P2PService {

    private static final Sort NEWEST_FIRST = Sort.by(Sort.Direction.DESC, "createdAt");

    private final P2PRequestRepository p2PRequestRepository;
    private final P2POrderRepository p2POrderRepository;
    private final CurrencyService currencyService;
    private final P2PRateBoundsService p2PRateBoundsService;
    private final AuditRecorder auditRecorder;
    private final ApplicationEventPublisher eventPublisher;

    @Transactional
    public P2PRequestResponse create(UUID userId, CreateP2PRequestDto request) {
        String base = normalize(request.baseCurrencyCode());
        String quote = normalize(request.quoteCurrencyCode());
        if (base.equals(quote)) {
            throw new BusinessException("P2P_SAME_CURRENCY", "Base and quote currencies must differ", HttpStatus.BAD_REQUEST);
        }
        currencyService.requireExists(base);
        currencyService.requireExists(quote);
        p2PRateBoundsService.requireRateWithinBounds(base, quote, request.rate());
        if (request.expiresAt() != null && !request.expiresAt().isAfter(Instant.now())) {
            throw new BusinessException("P2P_EXPIRES_INVALID", "expiresAt must be in the future", HttpStatus.BAD_REQUEST);
        }

        P2PRequest entity = new P2PRequest();
        entity.setUserId(userId);
        entity.setSide(request.side());
        entity.setBaseCurrencyCode(base);
        entity.setQuoteCurrencyCode(quote);
        entity.setAmount(request.amount());
        entity.setRate(request.rate());
        entity.setStatus(P2PStatus.OPEN);
        entity.setExpiresAt(request.expiresAt());
        entity.setNotes(trimToNull(request.notes()));
        p2PRequestRepository.save(entity);
        return toRequestResponse(entity);
    }

    @Transactional
    public P2PRequestResponse update(UUID userId, UUID requestId, UpdateP2PRequestDto request) {
        P2PRequest entity = requireOwnedOpen(userId, requestId);
        refreshExpiry(entity);

        if (request.amount() != null) {
            entity.setAmount(request.amount());
        }
        if (request.rate() != null) {
            p2PRateBoundsService.requireRateWithinBounds(
                    entity.getBaseCurrencyCode(), entity.getQuoteCurrencyCode(), request.rate());
            entity.setRate(request.rate());
        }
        if (request.expiresAt() != null) {
            if (!request.expiresAt().isAfter(Instant.now())) {
                throw new BusinessException("P2P_EXPIRES_INVALID", "expiresAt must be in the future", HttpStatus.BAD_REQUEST);
            }
            entity.setExpiresAt(request.expiresAt());
        }
        if (request.notes() != null) {
            entity.setNotes(trimToNull(request.notes()));
        }
        p2PRequestRepository.save(entity);
        return toRequestResponse(entity);
    }

    /**
     * Soft-delete / cancel: OPEN → CANCELLED (owner only).
     * CONTRACT_PENDING (P8-04): hard delete vs cancel semantics.
     */
    @Transactional
    public void delete(UUID userId, UUID requestId) {
        P2PRequest entity = requireOwnedOpen(userId, requestId);
        entity.setStatus(P2PStatus.CANCELLED);
        p2PRequestRepository.save(entity);
        publishClosed(entity);
    }

    @Transactional
    public P2POrderResponse accept(UUID acceptorId, UUID requestId) {
        return acceptInternal(acceptorId, requestId, null, null);
    }

    /**
     * Accept with optional renegotiated terms (used by Phase 9 negotiation).
     * CONTRACT_PENDING (P8-03 / P9-04): settlement still deferred.
     */
    @Transactional
    public P2POrderResponse acceptWithTerms(
            UUID acceptorId, UUID requestId, java.math.BigDecimal amount, java.math.BigDecimal rate) {
        if (amount == null || rate == null) {
            throw new BusinessException("P2P_TERMS_REQUIRED", "amount and rate are required", HttpStatus.BAD_REQUEST);
        }
        if (amount.compareTo(java.math.BigDecimal.ZERO) <= 0 || rate.compareTo(java.math.BigDecimal.ZERO) <= 0) {
            throw new BusinessException("P2P_TERMS_INVALID", "amount and rate must be positive", HttpStatus.BAD_REQUEST);
        }
        return acceptInternal(acceptorId, requestId, amount, rate);
    }

    private P2POrderResponse acceptInternal(
            UUID acceptorId,
            UUID requestId,
            java.math.BigDecimal amount,
            java.math.BigDecimal rate) {
        P2PRequest request = p2PRequestRepository.findByIdForUpdate(requestId)
                .orElseThrow(() -> new ResourceNotFoundException("P2P request not found"));
        refreshExpiry(request);

        if (request.getStatus() != P2PStatus.OPEN) {
            throw new BusinessException(
                    "P2P_NOT_OPEN",
                    "Request is not open: " + request.getStatus(),
                    HttpStatus.CONFLICT);
        }
        if (request.getUserId().equals(acceptorId)) {
            throw new BusinessException("P2P_SELF_ACCEPT", "Cannot accept your own request", HttpStatus.CONFLICT);
        }

        if (amount != null) {
            request.setAmount(amount);
        }
        if (rate != null) {
            request.setRate(rate);
        }

        request.setStatus(P2PStatus.ACCEPTED);
        p2PRequestRepository.save(request);
        publishClosed(request);

        P2POrder order = new P2POrder();
        order.setRequestId(request.getId());
        order.setRequesterId(request.getUserId());
        order.setAcceptorId(acceptorId);
        order.setAmount(request.getAmount());
        order.setRate(request.getRate());
        order.setStatus(P2PStatus.ACCEPTED);
        p2POrderRepository.save(order);
        return toOrderResponse(order);
    }

    @Transactional
    public P2PRequestResponse getRequest(UUID requestId) {
        P2PRequest entity = p2PRequestRepository.findById(requestId)
                .orElseThrow(() -> new ResourceNotFoundException("P2P request not found"));
        refreshExpiry(entity);
        return toRequestResponse(entity);
    }

    @Transactional(readOnly = true)
    public List<P2PRequestResponse> listOpen() {
        return p2PRequestRepository.findByStatusOrderByCreatedAtDesc(P2PStatus.OPEN).stream()
                .map(this::maybeExpire)
                .filter(r -> r.getStatus() == P2PStatus.OPEN)
                .map(this::toRequestResponse)
                .toList();
    }

    /** Open requests for the public rates board (no owner id or notes). */
    @Transactional(readOnly = true)
    public List<PublicP2PRateResponse> listOpenPublicRates() {
        return listOpen().stream()
                .map(r -> new PublicP2PRateResponse(
                        r.id(),
                        r.side(),
                        r.baseCurrencyCode(),
                        r.quoteCurrencyCode(),
                        r.amount(),
                        r.rate(),
                        r.expiresAt(),
                        r.createdAt()))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<P2PRequestResponse> listMine(UUID userId) {
        return p2PRequestRepository.findByUserIdOrderByCreatedAtDesc(userId).stream()
                .map(this::toRequestResponse)
                .toList();
    }

    /** Orders where the user is requester or acceptor, newest first. */
    @Transactional(readOnly = true)
    public List<P2POrderSummaryResponse> listMyOrders(UUID userId) {
        List<P2POrder> orders = p2POrderRepository.findByRequesterIdOrAcceptorIdOrderByCreatedAtDesc(userId, userId);
        if (orders.isEmpty()) {
            return List.of();
        }
        Set<UUID> requestIds = orders.stream().map(P2POrder::getRequestId).collect(Collectors.toSet());
        Map<UUID, P2PRequest> requests = p2PRequestRepository.findAllById(requestIds).stream()
                .collect(Collectors.toMap(P2PRequest::getId, Function.identity()));
        return orders.stream()
                .map(order -> toOrderSummary(order, requests.get(order.getRequestId())))
                .toList();
    }

    @Transactional(readOnly = true)
    public P2POrderResponse getOrder(UUID userId, UUID orderId) {
        P2POrder order = p2POrderRepository.findById(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("P2P order not found"));
        if (!order.getRequesterId().equals(userId) && !order.getAcceptorId().equals(userId)) {
            throw new ResourceNotFoundException("P2P order not found");
        }
        return toOrderResponse(order);
    }

    private P2PRequest requireOwnedOpen(UUID userId, UUID requestId) {
        P2PRequest entity = p2PRequestRepository.findByIdAndUserId(requestId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("P2P request not found"));
        refreshExpiry(entity);
        if (entity.getStatus() != P2PStatus.OPEN) {
            throw new BusinessException(
                    "P2P_NOT_OPEN",
                    "Only OPEN requests can be modified: " + entity.getStatus(),
                    HttpStatus.CONFLICT);
        }
        return entity;
    }

    /** OPEN requests whose {@code expiresAt} has passed; candidates for {@link #expireIfDue}. */
    @Transactional(readOnly = true)
    public List<UUID> findExpiredOpenIds(Instant now) {
        return p2PRequestRepository.findOpenIdsExpiredBy(now);
    }

    /**
     * Records EXPIRED for one request if it is still OPEN and past {@code expiresAt} (re-checked
     * under the row lock, so racing accepts, cancels or other sweepers are safe).
     */
    @Transactional
    public boolean expireIfDue(UUID requestId) {
        return p2PRequestRepository.findByIdForUpdate(requestId)
                .map(entity -> {
                    P2PStatus before = entity.getStatus();
                    refreshExpiry(entity);
                    return before != entity.getStatus();
                })
                .orElse(false);
    }

    private void refreshExpiry(P2PRequest entity) {
        if (entity.getStatus() == P2PStatus.OPEN
                && entity.getExpiresAt() != null
                && !entity.getExpiresAt().isAfter(Instant.now())) {
            entity.setStatus(P2PStatus.EXPIRED);
            p2PRequestRepository.save(entity);
            publishClosed(entity);
        }
    }

    private void publishClosed(P2PRequest entity) {
        eventPublisher.publishEvent(new P2PRequestClosedEvent(entity.getId(), entity.getStatus()));
    }

    private P2PRequest maybeExpire(P2PRequest entity) {
        if (entity.getStatus() == P2PStatus.OPEN
                && entity.getExpiresAt() != null
                && !entity.getExpiresAt().isAfter(Instant.now())) {
            entity.setStatus(P2PStatus.EXPIRED);
            // read-only list path: do not persist here; filter as expired
        }
        return entity;
    }

    private static String normalize(String code) {
        return code.trim().toUpperCase(Locale.ROOT);
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private P2PRequestResponse toRequestResponse(P2PRequest entity) {
        return new P2PRequestResponse(
                entity.getId(),
                entity.getUserId(),
                entity.getSide(),
                entity.getBaseCurrencyCode(),
                entity.getQuoteCurrencyCode(),
                entity.getAmount(),
                entity.getRate(),
                entity.getStatus(),
                entity.getExpiresAt(),
                entity.getNotes(),
                entity.getCreatedAt()
        );
    }

    private P2POrderResponse toOrderResponse(P2POrder order) {
        return new P2POrderResponse(
                order.getId(),
                order.getRequestId(),
                order.getRequesterId(),
                order.getAcceptorId(),
                order.getAmount(),
                order.getRate(),
                order.getStatus(),
                order.getCreatedAt()
        );
    }

    private P2POrderSummaryResponse toOrderSummary(P2POrder order, P2PRequest request) {
        return new P2POrderSummaryResponse(
                order.getId(),
                order.getRequestId(),
                order.getRequesterId(),
                order.getAcceptorId(),
                request != null ? request.getSide() : null,
                request != null ? request.getBaseCurrencyCode() : null,
                request != null ? request.getQuoteCurrencyCode() : null,
                order.getAmount(),
                order.getRate(),
                order.getStatus(),
                order.getCreatedAt()
        );
    }

    /** Admin: list requests (all users). */
    @Transactional(readOnly = true)
    public List<P2PRequestResponse> adminListRequests(P2PStatus status, UUID userId) {
        Specification<P2PRequest> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (status != null) {
                predicates.add(cb.equal(root.get("status"), status));
            }
            if (userId != null) {
                predicates.add(cb.equal(root.get("userId"), userId));
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };
        return p2PRequestRepository.findAll(spec, NEWEST_FIRST).stream()
                .map(this::toRequestResponse)
                .toList();
    }

    /** Admin: list orders (all users); userId matches requester or acceptor. */
    @Transactional(readOnly = true)
    public List<P2POrderResponse> adminListOrders(P2PStatus status, UUID userId) {
        Specification<P2POrder> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (status != null) {
                predicates.add(cb.equal(root.get("status"), status));
            }
            if (userId != null) {
                predicates.add(cb.or(
                        cb.equal(root.get("requesterId"), userId),
                        cb.equal(root.get("acceptorId"), userId)));
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };
        return p2POrderRepository.findAll(spec, NEWEST_FIRST).stream()
                .map(this::toOrderResponse)
                .toList();
    }

    /**
     * Admin status override for requests/orders.
     * CONTRACT_PENDING (P8-06 / P15): full admin transition matrix.
     * Provisional: CANCELLED or COMPLETED only.
     */
    @Transactional
    public P2PRequestResponse adminUpdateRequestStatus(UUID requestId, P2PStatus status) {
        assertAdminP2PStatus(status);
        P2PRequest request = p2PRequestRepository.findById(requestId)
                .orElseThrow(() -> new ResourceNotFoundException("P2P request not found"));
        P2PStatus previous = request.getStatus();
        String old = String.valueOf(previous);
        request.setStatus(status);
        p2PRequestRepository.save(request);
        if (previous == P2PStatus.OPEN) {
            publishClosed(request);
        }
        auditRecorder.record(AuditRecord.builder("ADMIN_P2P_REQUEST_STATUS")
                .entity("P2PRequest:" + requestId)
                .userRef(request.getUserId())
                .oldValue("status=" + old)
                .newValue("status=" + status)
                .build());
        return toRequestResponse(request);
    }

    @Transactional
    public P2POrderResponse adminUpdateOrderStatus(UUID orderId, P2PStatus status) {
        assertAdminP2PStatus(status);
        P2POrder order = p2POrderRepository.findById(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("P2P order not found"));
        String old = String.valueOf(order.getStatus());
        order.setStatus(status);
        p2POrderRepository.save(order);
        auditRecorder.record(AuditRecord.builder("ADMIN_P2P_ORDER_STATUS")
                .entity("P2POrder:" + orderId)
                .oldValue("status=" + old)
                .newValue("status=" + status)
                .build());
        return toOrderResponse(order);
    }

    private static void assertAdminP2PStatus(P2PStatus status) {
        if (status != P2PStatus.CANCELLED && status != P2PStatus.COMPLETED) {
            throw new BusinessException(
                    "P2P_ADMIN_STATUS_INVALID",
                    "Admin may set CANCELLED or COMPLETED only",
                    HttpStatus.BAD_REQUEST);
        }
    }
}
