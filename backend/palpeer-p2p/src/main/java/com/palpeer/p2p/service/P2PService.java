package com.palpeer.p2p.service;

import com.palpeer.common.audit.AuditRecord;
import com.palpeer.common.audit.AuditRecorder;
import com.palpeer.common.exception.BusinessException;
import com.palpeer.common.exception.ResourceNotFoundException;
import com.palpeer.common.notify.BroadcastPushEvent;
import com.palpeer.common.notify.UserNotifyEvent;
import com.palpeer.currency.service.CurrencyService;
import com.palpeer.ledger.domain.LedgerEntry;
import com.palpeer.ledger.domain.LedgerEntryType;
import com.palpeer.ledger.service.LedgerPostingRequest;
import com.palpeer.ledger.service.LedgerService;
import com.palpeer.p2p.domain.P2POrder;
import com.palpeer.p2p.domain.P2PRequest;
import com.palpeer.p2p.domain.P2PSide;
import com.palpeer.p2p.domain.P2PStatus;
import com.palpeer.p2p.repository.P2POrderRepository;
import com.palpeer.p2p.repository.P2PRequestRepository;
import com.palpeer.p2p.web.dto.CreateP2PRequestDto;
import com.palpeer.p2p.web.dto.P2POrderResponse;
import com.palpeer.p2p.web.dto.P2POrderSummaryResponse;
import com.palpeer.p2p.web.dto.P2PRequestResponse;
import com.palpeer.p2p.web.dto.PublicP2PRateResponse;
import com.palpeer.p2p.web.dto.UpdateP2PRequestDto;
import com.palpeer.wallet.domain.Wallet;
import com.palpeer.wallet.repository.WalletRepository;
import jakarta.persistence.criteria.Predicate;
import java.math.BigDecimal;
import java.math.RoundingMode;
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
    private final WalletRepository walletRepository;
    private final LedgerService ledgerService;
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
        // SELL listings temporarily move the base amount available → pending until settle/cancel/expire.
        placeSellHold(entity);
        p2PRequestRepository.save(entity);
        broadcastP2PPosted(entity);
        return toRequestResponse(entity);
    }

    @Transactional
    public P2PRequestResponse update(UUID userId, UUID requestId, UpdateP2PRequestDto request) {
        P2PRequest entity = requireOwnedOpen(userId, requestId);
        refreshExpiry(entity);

        boolean amountChanged = false;
        if (request.amount() != null && request.amount().compareTo(entity.getAmount()) != 0) {
            entity.setAmount(request.amount());
            amountChanged = true;
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
        if (amountChanged && entity.getSide() == P2PSide.SELL) {
            releaseSellHold(entity);
            placeSellHold(entity);
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
        releaseSellHold(entity);
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

        // Negotiation may change amount: drop any SELL hold sized for the previous terms first.
        if (amount != null && amount.compareTo(request.getAmount()) != 0 && request.getHoldLedgerEntryId() != null) {
            releaseSellHold(request);
        }
        if (amount != null) {
            request.setAmount(amount);
        }
        if (rate != null) {
            request.setRate(rate);
        }

        P2POrder order = new P2POrder();
        order.setRequestId(request.getId());
        order.setRequesterId(request.getUserId());
        order.setAcceptorId(acceptorId);
        order.setAmount(request.getAmount());
        order.setRate(request.getRate());
        order.setStatus(P2PStatus.ACCEPTED);
        p2POrderRepository.save(order);

        settleAcceptedOrder(request, order);

        request.setStatus(P2PStatus.COMPLETED);
        order.setStatus(P2PStatus.COMPLETED);
        p2PRequestRepository.save(request);
        p2POrderRepository.save(order);
        publishClosed(request);
        notifyP2PAccepted(request, order);
        return toOrderResponse(order);
    }

    /**
     * Moves base from seller → buyer and quote from buyer → seller, then clears any SELL hold.
     * SELL listings: requester sells base; BUY listings: acceptor sells base.
     */
    private void settleAcceptedOrder(P2PRequest request, P2POrder order) {
        UUID sellerId = request.getSide() == P2PSide.SELL ? order.getRequesterId() : order.getAcceptorId();
        UUID buyerId = request.getSide() == P2PSide.SELL ? order.getAcceptorId() : order.getRequesterId();
        String base = request.getBaseCurrencyCode();
        String quote = request.getQuoteCurrencyCode();
        BigDecimal baseAmount = order.getAmount();
        int quotePrecision = currencyService.getByCode(quote).precision();
        BigDecimal quoteAmount = baseAmount
                .multiply(order.getRate())
                .setScale(quotePrecision, RoundingMode.HALF_EVEN);

        Wallet sellerBase = requireWallet(sellerId, base, "seller");
        Wallet buyerBase = requireWallet(buyerId, base, "buyer");
        Wallet buyerQuote = requireWallet(buyerId, quote, "buyer");
        Wallet sellerQuote = requireWallet(sellerId, quote, "seller");

        String orderRef = order.getId().toString();
        String prefix = "p2p-order:" + orderRef;

        // Base leg: seller pays base, buyer receives base.
        if (request.getSide() == P2PSide.SELL && request.getHoldLedgerEntryId() != null) {
            // Capture hold into a debit (pending → gone), then credit the buyer.
            captureSellHold(request);
        } else {
            ledgerService.post(new LedgerPostingRequest(
                    sellerBase.getId(),
                    LedgerEntryType.DEBIT,
                    baseAmount,
                    prefix + ":base-debit",
                    "P2P_ORDER",
                    orderRef,
                    "P2P settle — seller base debit"));
        }
        ledgerService.post(new LedgerPostingRequest(
                buyerBase.getId(),
                LedgerEntryType.CREDIT,
                baseAmount,
                prefix + ":base-credit",
                "P2P_ORDER",
                orderRef,
                "P2P settle — buyer base credit"));

        // Quote leg: buyer pays quote, seller receives quote.
        ledgerService.post(new LedgerPostingRequest(
                buyerQuote.getId(),
                LedgerEntryType.DEBIT,
                quoteAmount,
                prefix + ":quote-debit",
                "P2P_ORDER",
                orderRef,
                "P2P settle — buyer quote debit"));
        ledgerService.post(new LedgerPostingRequest(
                sellerQuote.getId(),
                LedgerEntryType.CREDIT,
                quoteAmount,
                prefix + ":quote-credit",
                "P2P_ORDER",
                orderRef,
                "P2P settle — seller quote credit"));

        auditRecorder.record(AuditRecord.builder("P2P_ORDER_SETTLED")
                .entity("P2POrder:" + order.getId())
                .userRef(order.getRequesterId())
                .newValue("seller="
                        + sellerId
                        + ";buyer="
                        + buyerId
                        + ";base="
                        + formatAmount(baseAmount)
                        + " "
                        + base
                        + ";quote="
                        + formatAmount(quoteAmount)
                        + " "
                        + quote)
                .build());
    }

    private Wallet requireWallet(UUID userId, String currencyCode, String role) {
        return walletRepository
                .findByUserIdAndCurrencyCodeIgnoreCase(userId, currencyCode)
                .orElseThrow(() -> new BusinessException(
                        "P2P_WALLET_REQUIRED",
                        "The "
                                + role
                                + " needs a "
                                + currencyCode
                                + " wallet before this order can settle",
                        HttpStatus.BAD_REQUEST));
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
            releaseSellHold(entity);
            entity.setStatus(P2PStatus.EXPIRED);
            p2PRequestRepository.save(entity);
            publishClosed(entity);
        }
    }

    private void publishClosed(P2PRequest entity) {
        eventPublisher.publishEvent(new P2PRequestClosedEvent(entity.getId(), entity.getStatus()));
    }

    private void broadcastP2PPosted(P2PRequest entity) {
        String amount = formatAmount(entity.getAmount());
        String rate = formatAmount(entity.getRate());
        String title = "New P2P " + entity.getSide().name() + " order";
        String body = entity.getSide().name()
                + " "
                + amount
                + " "
                + entity.getBaseCurrencyCode()
                + " for "
                + entity.getQuoteCurrencyCode()
                + " at rate "
                + rate
                + ". Order id: "
                + entity.getId();
        eventPublisher.publishEvent(new BroadcastPushEvent(
                entity.getUserId(), title, body, "P2P", "P2P_REQUEST", entity.getId()));
        // Poster also gets an email + push confirmation of their own listing
        eventPublisher.publishEvent(new UserNotifyEvent(
                entity.getUserId(),
                "P2P order posted",
                body,
                "P2P",
                "P2P_REQUEST",
                entity.getId(),
                true,
                true));
    }

    private void notifyP2PAccepted(P2PRequest request, P2POrder order) {
        String base = request.getBaseCurrencyCode();
        String quote = request.getQuoteCurrencyCode();
        int quotePrecision = currencyService.getByCode(quote).precision();
        BigDecimal quoteAmount = order.getAmount()
                .multiply(order.getRate())
                .setScale(quotePrecision, RoundingMode.HALF_EVEN);
        String baseLine = formatAmount(order.getAmount()) + " " + base;
        String quoteLine = formatAmount(quoteAmount) + " " + quote;
        String detail = baseLine + " exchanged for " + quoteLine + " (rate " + formatAmount(order.getRate()) + ")";

        UUID sellerId = request.getSide() == P2PSide.SELL ? order.getRequesterId() : order.getAcceptorId();
        UUID buyerId = request.getSide() == P2PSide.SELL ? order.getAcceptorId() : order.getRequesterId();

        eventPublisher.publishEvent(new UserNotifyEvent(
                sellerId,
                "P2P trade completed",
                "You sold " + baseLine + " and received " + quoteLine + ". " + detail + ".",
                "TRANSACTION",
                "P2P_ORDER",
                order.getId(),
                true,
                true));
        eventPublisher.publishEvent(new UserNotifyEvent(
                buyerId,
                "P2P trade completed",
                "You bought " + baseLine + " and paid " + quoteLine + ". " + detail + ".",
                "TRANSACTION",
                "P2P_ORDER",
                order.getId(),
                true,
                true));
    }

    private static String formatAmount(BigDecimal amount) {
        return amount == null ? "0" : amount.stripTrailingZeros().toPlainString();
    }

    /**
     * SELL listings: hold base currency from the seller's wallet (available → pending).
     * Released on cancel/expire; captured (RELEASE + DEBIT) when the order completes.
     */
    private void placeSellHold(P2PRequest entity) {
        if (entity.getSide() != P2PSide.SELL || entity.getHoldLedgerEntryId() != null) {
            return;
        }
        Wallet wallet = walletRepository
                .findByUserIdAndCurrencyCodeIgnoreCase(entity.getUserId(), entity.getBaseCurrencyCode())
                .orElseThrow(() -> new BusinessException(
                        "P2P_WALLET_REQUIRED",
                        "Create a " + entity.getBaseCurrencyCode() + " wallet before posting a sell request",
                        HttpStatus.BAD_REQUEST));
        LedgerEntry hold = ledgerService.post(new LedgerPostingRequest(
                wallet.getId(),
                LedgerEntryType.HOLD,
                entity.getAmount(),
                "p2p-request:" + entity.getId() + ":hold",
                "P2P_REQUEST",
                entity.getId().toString(),
                "P2P sell hold"));
        entity.setHoldWalletId(wallet.getId());
        entity.setHoldLedgerEntryId(hold.getId());
    }

    private void releaseSellHold(P2PRequest entity) {
        if (entity.getHoldLedgerEntryId() == null || entity.getHoldWalletId() == null) {
            return;
        }
        BigDecimal amount = entity.getAmount();
        ledgerService.post(new LedgerPostingRequest(
                entity.getHoldWalletId(),
                LedgerEntryType.RELEASE,
                amount,
                "p2p-request:" + entity.getId() + ":release",
                "P2P_REQUEST",
                entity.getId().toString(),
                "P2P sell hold release"));
        entity.setHoldLedgerEntryId(null);
        entity.setHoldWalletId(null);
    }

    /** Permanent take of a SELL hold after a successful exchange (RELEASE then DEBIT). */
    private void captureSellHold(P2PRequest entity) {
        if (entity.getHoldLedgerEntryId() == null || entity.getHoldWalletId() == null) {
            return;
        }
        UUID walletId = entity.getHoldWalletId();
        BigDecimal amount = entity.getAmount();
        ledgerService.post(new LedgerPostingRequest(
                walletId,
                LedgerEntryType.RELEASE,
                amount,
                "p2p-request:" + entity.getId() + ":capture-release",
                "P2P_REQUEST",
                entity.getId().toString(),
                "P2P sell capture — release hold"));
        ledgerService.post(new LedgerPostingRequest(
                walletId,
                LedgerEntryType.DEBIT,
                amount,
                "p2p-request:" + entity.getId() + ":capture-debit",
                "P2P_REQUEST",
                entity.getId().toString(),
                "P2P sell capture — debit"));
        entity.setHoldLedgerEntryId(null);
        entity.setHoldWalletId(null);
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
                order.getCreatedAt(),
                request != null ? request.getExpiresAt() : null
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
        if (status == P2PStatus.CANCELLED) {
            releaseSellHold(request);
        } else if (status == P2PStatus.COMPLETED) {
            captureSellHold(request);
        }
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
        P2PRequest request = p2PRequestRepository.findById(order.getRequestId()).orElse(null);
        if (request != null) {
            if (status == P2PStatus.COMPLETED) {
                captureSellHold(request);
                p2PRequestRepository.save(request);
            } else if (status == P2PStatus.CANCELLED) {
                releaseSellHold(request);
                p2PRequestRepository.save(request);
            }
        }
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
