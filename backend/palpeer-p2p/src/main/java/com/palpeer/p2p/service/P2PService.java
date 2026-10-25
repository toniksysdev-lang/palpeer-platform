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
import com.palpeer.p2p.web.dto.P2PFeeEstimateResponse;
import com.palpeer.p2p.web.dto.P2POrderResponse;
import com.palpeer.p2p.web.dto.P2POrderSummaryResponse;
import com.palpeer.p2p.web.dto.P2PRequestResponse;
import com.palpeer.p2p.web.dto.PublicP2PRateResponse;
import com.palpeer.p2p.web.dto.PublicP2PRequestResponse;
import com.palpeer.p2p.web.dto.UpdateP2PRequestDto;
import com.palpeer.profile.domain.Profile;
import com.palpeer.profile.repository.ProfileRepository;
import com.palpeer.promotion.service.PromotionService;
import com.palpeer.promotion.web.dto.P2PFeePromotionDiscount;
import com.palpeer.user.domain.User;
import com.palpeer.user.repository.UserRepository;
import com.palpeer.wallet.domain.PlatformFeeSourceType;
import com.palpeer.wallet.domain.Wallet;
import com.palpeer.wallet.repository.WalletRepository;
import com.palpeer.wallet.service.PlatformFeeRevenueService;
import jakarta.persistence.criteria.Predicate;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
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
    private final P2PFeeTierService p2PFeeTierService;
    private final WalletRepository walletRepository;
    private final ProfileRepository profileRepository;
    private final UserRepository userRepository;
    private final LedgerService ledgerService;
    private final PlatformFeeRevenueService platformFeeRevenueService;
    private final PromotionService promotionService;
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
        entity.setApplyBonusCredit(Boolean.TRUE.equals(request.applyBonusCredit()));
        // Flush so the request id exists before the ledger idempotency key is built.
        p2PRequestRepository.saveAndFlush(entity);
        // SELL listings temporarily move the base (sold) amount available → pending until settle/cancel/expire.
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
        if (request.applyBonusCredit() != null) {
            entity.setApplyBonusCredit(request.applyBonusCredit());
        }
        if (amountChanged && entity.getSide() == P2PSide.SELL) {
            releaseSellHold(entity);
            placeSellHold(entity);
        }
        p2PRequestRepository.save(entity);
        return toRequestResponse(entity);
    }

    /**
     * Owner DELETE on a request:
     * <ul>
     *   <li>OPEN → cancel (CANCELLED) and release any sell hold</li>
     *   <li>CANCELLED or EXPIRED → archive (remove from the owner's history)</li>
     * </ul>
     */
    @Transactional
    public void delete(UUID userId, UUID requestId) {
        P2PRequest entity = p2PRequestRepository.findByIdAndUserId(requestId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("P2P request not found"));
        if (entity.getArchivedAt() != null) {
            throw new ResourceNotFoundException("P2P request not found");
        }
        refreshExpiry(entity);
        if (entity.getStatus() == P2PStatus.OPEN) {
            releaseSellHold(entity);
            entity.setStatus(P2PStatus.CANCELLED);
            p2PRequestRepository.save(entity);
            publishClosed(entity);
            return;
        }
        if (entity.getStatus() == P2PStatus.CANCELLED || entity.getStatus() == P2PStatus.EXPIRED) {
            entity.setArchivedAt(Instant.now());
            p2PRequestRepository.save(entity);
            return;
        }
        throw new BusinessException(
                "P2P_NOT_DELETABLE",
                "Only open, cancelled, or expired requests can be removed: " + entity.getStatus(),
                HttpStatus.CONFLICT);
    }

    /**
     * Participant DELETE on a cancelled order: archives it for that user only (other party still sees it).
     */
    @Transactional
    public void deleteOrder(UUID userId, UUID orderId) {
        P2POrder order = p2POrderRepository.findByIdAndPartyUserId(orderId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("P2P order not found"));
        if (order.getStatus() != P2PStatus.CANCELLED) {
            throw new BusinessException(
                    "P2P_ORDER_NOT_DELETABLE",
                    "Only cancelled orders can be removed from history",
                    HttpStatus.CONFLICT);
        }
        Instant now = Instant.now();
        if (order.getRequesterId().equals(userId)) {
            if (order.getRequesterArchivedAt() != null) {
                throw new ResourceNotFoundException("P2P order not found");
            }
            order.setRequesterArchivedAt(now);
        }
        if (order.getAcceptorId().equals(userId)) {
            if (order.getAcceptorArchivedAt() != null) {
                throw new ResourceNotFoundException("P2P order not found");
            }
            order.setAcceptorArchivedAt(now);
        }
        p2POrderRepository.save(order);
    }

    @Transactional
    public P2POrderResponse accept(UUID acceptorId, UUID requestId) {
        return accept(acceptorId, requestId, null, null);
    }

    @Transactional
    public P2POrderResponse accept(UUID acceptorId, UUID requestId, Boolean applyBonusCredit) {
        return accept(acceptorId, requestId, applyBonusCredit, null);
    }

    @Transactional
    public P2POrderResponse accept(
            UUID acceptorId, UUID requestId, Boolean applyBonusCredit, String promotionCode) {
        return acceptInternal(acceptorId, requestId, null, null, applyBonusCredit, promotionCode);
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
        return acceptInternal(acceptorId, requestId, amount, rate, null, null);
    }

    private P2POrderResponse acceptInternal(
            UUID acceptorId,
            UUID requestId,
            java.math.BigDecimal amount,
            java.math.BigDecimal rate,
            Boolean applyBonusCredit,
            String promotionCode) {
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

        UUID buyerId = request.getSide() == P2PSide.SELL ? acceptorId : request.getUserId();
        boolean useBonusCredit = request.isApplyBonusCredit();
        if (applyBonusCredit != null && acceptorId.equals(buyerId)) {
            useBonusCredit = applyBonusCredit;
        }

        settleAcceptedOrder(request, order, useBonusCredit, promotionCode);

        request.setStatus(P2PStatus.COMPLETED);
        order.setStatus(P2PStatus.COMPLETED);
        p2PRequestRepository.save(request);
        p2POrderRepository.save(order);
        publishClosed(request);
        notifyP2PAccepted(request, order);
        // Either party completing a P2P trade can unlock a pending referrer bonus (as invitee).
        eventPublisher.publishEvent(
                new com.palpeer.common.notify.UserQualifyingTradeCompletedEvent(order.getRequesterId()));
        eventPublisher.publishEvent(
                new com.palpeer.common.notify.UserQualifyingTradeCompletedEvent(order.getAcceptorId()));
        return toOrderResponse(order);
    }

    /**
     * Moves base from seller → buyer and quote from buyer → seller, then clears any SELL hold.
     * SELL listings: requester sells base; BUY listings: acceptor sells base.
     */
    private void settleAcceptedOrder(
            P2PRequest request, P2POrder order, boolean applyBonusCredit, String promotionCode) {
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

        // Fail fast with a clear code before any ledger posts (buyer quote + seller base when unheld).
        assertSufficientAvailable(buyerQuote, quoteAmount, "buyer");
        boolean sellHoldCoversBase =
                request.getSide() == P2PSide.SELL && request.getHoldLedgerEntryId() != null;
        if (!sellHoldCoversBase) {
            assertSufficientAvailable(sellerBase, baseAmount, "seller");
        }

        String orderRef = order.getId().toString();
        String prefix = "p2p-order:" + orderRef;

        // Base leg: seller pays base, buyer receives base.
        if (sellHoldCoversBase) {
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

        BigDecimal grossFee = scaledP2PFee(base, quote, baseAmount, order.getRate());
        if (grossFee != null && grossFee.signum() > 0) {
            BigDecimal fee = promotionService.applyP2PFeeDiscount(
                    buyerId, base, grossFee, applyBonusCredit, promotionCode);
            if (fee != null && fee.signum() > 0) {
                order.setFeeAmount(fee);
                order.setFeeCurrencyCode(base);
                ledgerService.post(new LedgerPostingRequest(
                        buyerBase.getId(),
                        LedgerEntryType.DEBIT,
                        fee,
                        prefix + ":fee-debit",
                        "P2P_ORDER",
                        orderRef,
                        "P2P settle — buyer platform fee"));
                platformFeeRevenueService.record(
                        PlatformFeeSourceType.P2P,
                        "P2P_ORDER",
                        order.getId(),
                        buyerId,
                        base,
                        fee,
                        "P2P platform fee");
            } else {
                order.setFeeAmount(BigDecimal.ZERO);
                order.setFeeCurrencyCode(base);
            }
        }

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
                        + quote
                        + (order.getFeeAmount() != null
                                ? ";fee=" + formatAmount(order.getFeeAmount()) + " " + order.getFeeCurrencyCode()
                                : ""))
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

    private static void assertSufficientAvailable(Wallet wallet, BigDecimal required, String role) {
        BigDecimal available =
                wallet.getAvailableBalance() == null ? BigDecimal.ZERO : wallet.getAvailableBalance();
        if (available.compareTo(required) < 0) {
            throw new BusinessException(
                    "INSUFFICIENT_AVAILABLE_BALANCE",
                    "The "
                            + role
                            + " needs at least "
                            + required.toPlainString()
                            + " "
                            + wallet.getCurrencyCode()
                            + " available",
                    HttpStatus.UNPROCESSABLE_ENTITY);
        }
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
        List<P2PRequest> open = p2PRequestRepository.findByStatusOrderByCreatedAtDesc(P2PStatus.OPEN).stream()
                .map(this::maybeExpire)
                .filter(r -> r.getStatus() == P2PStatus.OPEN)
                .toList();
        return toRequestResponses(open);
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

    /**
     * Single open request for share / guest Accept — no owner id or notes.
     * Expired or non-open requests are treated as not found.
     */
    @Transactional
    public PublicP2PRequestResponse getOpenPublicRequest(UUID requestId) {
        P2PRequest entity = p2PRequestRepository.findById(requestId)
                .orElseThrow(() -> new ResourceNotFoundException("P2P request not found"));
        refreshExpiry(entity);
        if (entity.getStatus() != P2PStatus.OPEN) {
            throw new ResourceNotFoundException("P2P request not found");
        }
        return new PublicP2PRequestResponse(
                entity.getId(),
                entity.getSide(),
                entity.getStatus(),
                entity.getBaseCurrencyCode(),
                entity.getQuoteCurrencyCode(),
                entity.getAmount(),
                entity.getRate(),
                resolvePosterDisplayName(entity.getUserId()),
                entity.getExpiresAt(),
                entity.getCreatedAt());
    }

    @Transactional(readOnly = true)
    public List<P2PRequestResponse> listMine(UUID userId) {
        return toRequestResponses(
                p2PRequestRepository.findByUserIdAndArchivedAtIsNullOrderByCreatedAtDesc(userId));
    }

    /** Orders where the user is requester or acceptor (and has not archived), newest first. */
    @Transactional(readOnly = true)
    public List<P2POrderSummaryResponse> listMyOrders(UUID userId) {
        List<P2POrder> orders = p2POrderRepository.findVisibleForUserOrderByCreatedAtDesc(userId);
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
        if (order.getRequesterId().equals(userId) && order.getRequesterArchivedAt() != null) {
            throw new ResourceNotFoundException("P2P order not found");
        }
        if (order.getAcceptorId().equals(userId) && order.getAcceptorArchivedAt() != null) {
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
        String pair = entity.getBaseCurrencyCode() + "/" + entity.getQuoteCurrencyCode();
        String title = "New P2P " + entity.getSide().name() + " · " + pair;
        StringBuilder body = new StringBuilder();
        body.append(entity.getSide().name())
                .append(' ')
                .append(amount)
                .append(' ')
                .append(entity.getBaseCurrencyCode())
                .append(" → ")
                .append(entity.getQuoteCurrencyCode())
                .append(" @ ")
                .append(rate);
        if (entity.getNotes() != null && !entity.getNotes().isBlank()) {
            body.append(". Note: ").append(entity.getNotes().trim());
        }
        body.append('.');
        String detail = body.toString();
        // Push + in-app to everyone except the poster (marketplace alert with request details).
        eventPublisher.publishEvent(new BroadcastPushEvent(
                entity.getUserId(), title, detail, "P2P", "P2P_REQUEST", entity.getId()));
        // Poster also gets an email + push confirmation of their own listing
        eventPublisher.publishEvent(new UserNotifyEvent(
                entity.getUserId(),
                "P2P order posted",
                detail,
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
     * SELL listings: hold the sold currency (API base) from the seller's wallet (available → pending).
     * Works for every base currency (CAD, NGN, USD, …). Released on cancel/expire; captured on settle.
     */
    private void placeSellHold(P2PRequest entity) {
        if (entity.getSide() != P2PSide.SELL || entity.getHoldLedgerEntryId() != null) {
            return;
        }
        if (entity.getId() == null) {
            throw new IllegalStateException("P2P request id required before placing sell hold");
        }
        String soldCurrency = normalize(entity.getBaseCurrencyCode());
        Wallet wallet = walletRepository
                .findByUserIdAndCurrencyCodeIgnoreCase(entity.getUserId(), soldCurrency)
                .orElseThrow(() -> new BusinessException(
                        "P2P_WALLET_REQUIRED",
                        "Create a " + soldCurrency + " wallet before posting a sell request",
                        HttpStatus.BAD_REQUEST));
        if (!soldCurrency.equalsIgnoreCase(wallet.getCurrencyCode())) {
            throw new IllegalStateException(
                    "Sell hold wallet currency mismatch: expected " + soldCurrency + " got " + wallet.getCurrencyCode());
        }
        LedgerEntry hold = ledgerService.post(new LedgerPostingRequest(
                wallet.getId(),
                LedgerEntryType.HOLD,
                entity.getAmount(),
                "p2p-request:" + entity.getId() + ":hold",
                "P2P_REQUEST",
                entity.getId().toString(),
                "P2P sell hold " + soldCurrency));
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

    private List<P2PRequestResponse> toRequestResponses(Collection<P2PRequest> entities) {
        if (entities.isEmpty()) {
            return List.of();
        }
        Set<UUID> userIds = entities.stream().map(P2PRequest::getUserId).collect(Collectors.toSet());
        Map<UUID, Profile> profiles = profileRepository.findByUserIdIn(userIds).stream()
                .collect(Collectors.toMap(Profile::getUserId, Function.identity(), (a, b) -> a));
        Map<UUID, User> users = new HashMap<>();
        for (User user : userRepository.findAllById(userIds)) {
            users.put(user.getId(), user);
        }
        return entities.stream()
                .map(entity -> toRequestResponse(
                        entity, resolvePosterDisplayName(entity.getUserId(), profiles, users)))
                .toList();
    }

    private P2PRequestResponse toRequestResponse(P2PRequest entity) {
        return toRequestResponse(entity, resolvePosterDisplayName(entity.getUserId()));
    }

    private P2PRequestResponse toRequestResponse(P2PRequest entity, String posterDisplayName) {
        String base = entity.getBaseCurrencyCode();
        BigDecimal estimatedFee =
                scaledP2PFee(base, entity.getQuoteCurrencyCode(), entity.getAmount(), entity.getRate());
        return new P2PRequestResponse(
                entity.getId(),
                entity.getUserId(),
                posterDisplayName,
                entity.getSide(),
                base,
                entity.getQuoteCurrencyCode(),
                entity.getAmount(),
                entity.getRate(),
                entity.getStatus(),
                entity.getExpiresAt(),
                entity.getNotes(),
                entity.getCreatedAt(),
                estimatedFee,
                estimatedFee != null ? base : null,
                entity.isApplyBonusCredit());
    }

    private BigDecimal scaledP2PFee(
            String baseCurrencyCode, String quoteCurrencyCode, BigDecimal amount, BigDecimal rate) {
        BigDecimal fee = p2PFeeTierService.resolveFee(baseCurrencyCode, quoteCurrencyCode, amount, rate);
        if (fee == null || fee.signum() <= 0) {
            return null;
        }
        int basePrecision = currencyService.getByCode(baseCurrencyCode).precision();
        return fee.setScale(basePrecision, RoundingMode.HALF_EVEN);
    }

    private String resolvePosterDisplayName(UUID userId) {
        Map<UUID, Profile> profiles = profileRepository
                .findByUserId(userId)
                .map(profile -> Map.of(userId, profile))
                .orElseGet(Map::of);
        Map<UUID, User> users = userRepository
                .findById(userId)
                .map(user -> Map.of(userId, user))
                .orElseGet(Map::of);
        return resolvePosterDisplayName(userId, profiles, users);
    }

    private static String resolvePosterDisplayName(
            UUID userId, Map<UUID, Profile> profiles, Map<UUID, User> users) {
        Profile profile = profiles.get(userId);
        if (profile != null) {
            String name = profileFullName(profile);
            if (!name.isBlank()) {
                return name;
            }
        }
        User user = users.get(userId);
        if (user != null && user.getEmail() != null && user.getEmail().contains("@")) {
            return user.getEmail().substring(0, user.getEmail().indexOf('@'));
        }
        return "Palpeer user";
    }

    private static String profileFullName(Profile profile) {
        String first = profile.getFirstName() == null ? "" : profile.getFirstName().trim();
        String last = profile.getLastName() == null ? "" : profile.getLastName().trim();
        return (first + " " + last).trim();
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
                order.getCreatedAt(),
                order.getFeeAmount(),
                order.getFeeCurrencyCode());
    }

    /**
     * Fee preview for mobile create/accept flows. Promo discount applies only when the buyer
     * supplies a matching {@code promotionCode}; bonus credit only when {@code applyBonusCredit}.
     */
    @Transactional(readOnly = true)
    public P2PFeeEstimateResponse estimateFee(
            UUID viewerId,
            String baseCurrencyCode,
            String quoteCurrencyCode,
            BigDecimal amount,
            BigDecimal rate,
            boolean applyBonusCredit) {
        return estimateFee(
                viewerId, baseCurrencyCode, quoteCurrencyCode, amount, rate, applyBonusCredit, null);
    }

    @Transactional(readOnly = true)
    public P2PFeeEstimateResponse estimateFee(
            UUID viewerId,
            String baseCurrencyCode,
            String quoteCurrencyCode,
            BigDecimal amount,
            BigDecimal rate,
            boolean applyBonusCredit,
            String promotionCode) {
        String base = normalize(baseCurrencyCode);
        String quote = normalize(quoteCurrencyCode);
        currencyService.requireExists(base);
        currencyService.requireExists(quote);
        if (amount == null || amount.signum() <= 0) {
            return new P2PFeeEstimateResponse(
                    base, quote, amount, null, null, null, null, null, null);
        }
        BigDecimal fee = scaledP2PFee(base, quote, amount, rate);
        if (fee == null || fee.signum() <= 0) {
            return new P2PFeeEstimateResponse(
                    base, quote, amount, null, null, null, null, null, null);
        }
        if (viewerId == null) {
            return new P2PFeeEstimateResponse(
                    base, quote, amount, fee, base, BigDecimal.ZERO, fee, null, BigDecimal.ZERO);
        }
        P2PFeePromotionDiscount discount = promotionService.previewP2PFeeDiscount(
                viewerId, base, fee, applyBonusCredit, promotionCode);
        return new P2PFeeEstimateResponse(
                base,
                quote,
                amount,
                discount.originalFeeAmount(),
                base,
                discount.discountAmount(),
                discount.feeAfterDiscount(),
                discount.promotionCode(),
                discount.pendingBonusCredit());
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
        return toRequestResponses(p2PRequestRepository.findAll(spec, NEWEST_FIRST));
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
