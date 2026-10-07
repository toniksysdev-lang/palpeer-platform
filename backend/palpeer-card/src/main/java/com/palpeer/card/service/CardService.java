package com.palpeer.card.service;

import com.palpeer.card.domain.Card;
import com.palpeer.card.domain.CardStatus;
import com.palpeer.card.domain.CardTransaction;
import com.palpeer.card.provider.CardProvider;
import com.palpeer.card.provider.CardProvider.ProviderCardIssueRequest;
import com.palpeer.card.provider.CardProvider.ProviderCardIssueResult;
import com.palpeer.card.provider.CardProvider.ProviderCardTransaction;
import com.palpeer.card.repository.CardRepository;
import com.palpeer.card.repository.CardTransactionRepository;
import com.palpeer.card.web.dto.AdminCardResponse;
import com.palpeer.card.web.dto.CardResponse;
import com.palpeer.card.web.dto.CardTransactionResponse;
import com.palpeer.card.web.dto.IssueCardRequest;
import com.palpeer.common.audit.AuditRecord;
import com.palpeer.common.audit.AuditRecorder;
import com.palpeer.common.exception.BusinessException;
import com.palpeer.common.exception.ResourceNotFoundException;
import com.palpeer.currency.service.CurrencyService;
import com.palpeer.wallet.domain.Wallet;
import com.palpeer.wallet.repository.WalletRepository;
import jakarta.persistence.criteria.Predicate;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class CardService {

    private final CardRepository cardRepository;
    private final CardTransactionRepository cardTransactionRepository;
    private final CardProvider cardProvider;
    private final CurrencyService currencyService;
    private final WalletRepository walletRepository;
    private final AuditRecorder auditRecorder;

    @Transactional
    public CardResponse issue(UUID userId, IssueCardRequest request) {
        String currency = normalize(request.currencyCode());
        currencyService.requireExists(currency);

        UUID walletId = null;
        if (request.walletId() != null) {
            Wallet wallet = walletRepository.findByIdAndUserId(request.walletId(), userId)
                    .orElseThrow(() -> new ResourceNotFoundException("Wallet not found"));
            if (!wallet.getCurrencyCode().equals(currency)) {
                throw new BusinessException(
                        "CARD_WALLET_CURRENCY_MISMATCH",
                        "Wallet currency must match card currency",
                        HttpStatus.BAD_REQUEST);
            }
            walletId = wallet.getId();
        }

        ProviderCardIssueResult issued = cardProvider.issueCard(
                new ProviderCardIssueRequest(userId, currency, trimToNull(request.cardholderName())));

        Card card = new Card();
        card.setUserId(userId);
        card.setWalletId(walletId);
        card.setProviderName(cardProvider.providerName());
        card.setProviderCardId(issued.providerCardId());
        card.setLastFour(issued.lastFour());
        card.setBrand(issued.brand());
        card.setCurrencyCode(currency);
        card.setStatus(CardStatus.ACTIVE);
        card.setExpiryMonth(toShort(issued.expiryMonth()));
        card.setExpiryYear(toShort(issued.expiryYear()));
        card.setCardholderName(trimToNull(request.cardholderName()));
        cardRepository.save(card);
        auditRecorder.record(AuditRecord.builder("CARD_ISSUE")
                .entity("Card:" + card.getId())
                .userRef(userId)
                .newValue("status=" + card.getStatus()
                        + ";currency=" + card.getCurrencyCode()
                        + ";lastFour=" + card.getLastFour())
                .build());
        return toCardResponse(card);
    }

    @Transactional(readOnly = true)
    public List<CardResponse> list(UUID userId) {
        return cardRepository.findByUserIdOrderByCreatedAtDesc(userId).stream()
                .map(this::toCardResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public CardResponse get(UUID userId, UUID cardId) {
        return toCardResponse(requireOwned(userId, cardId));
    }

    @Transactional
    public CardResponse block(UUID userId, UUID cardId) {
        Card card = requireOwned(userId, cardId);
        if (card.getStatus() == CardStatus.CLOSED) {
            throw new BusinessException("CARD_CLOSED", "Closed card cannot be blocked", HttpStatus.CONFLICT);
        }
        if (card.getStatus() == CardStatus.BLOCKED) {
            return toCardResponse(card);
        }
        cardProvider.blockCard(card.getProviderCardId());
        String old = String.valueOf(card.getStatus());
        card.setStatus(CardStatus.BLOCKED);
        cardRepository.save(card);
        auditRecorder.record(AuditRecord.builder("CARD_BLOCK")
                .entity("Card:" + card.getId())
                .userRef(userId)
                .oldValue("status=" + old)
                .newValue("status=BLOCKED")
                .build());
        return toCardResponse(card);
    }

    @Transactional
    public CardResponse unblock(UUID userId, UUID cardId) {
        Card card = requireOwned(userId, cardId);
        if (card.getStatus() != CardStatus.BLOCKED) {
            throw new BusinessException(
                    "CARD_NOT_BLOCKED",
                    "Only blocked cards can be unblocked",
                    HttpStatus.CONFLICT);
        }
        cardProvider.unblockCard(card.getProviderCardId());
        card.setStatus(CardStatus.ACTIVE);
        cardRepository.save(card);
        auditRecorder.record(AuditRecord.builder("CARD_UNBLOCK")
                .entity("Card:" + card.getId())
                .userRef(userId)
                .oldValue("status=BLOCKED")
                .newValue("status=ACTIVE")
                .build());
        return toCardResponse(card);
    }

    /**
     * Sync provider transactions into local CardTransaction rows (idempotent by providerTransactionId).
     * Does not post ledger entries (P13-05).
     */
    @Transactional
    public Page<CardTransactionResponse> syncAndListTransactions(UUID userId, UUID cardId, Pageable pageable) {
        Card card = requireOwned(userId, cardId);
        for (ProviderCardTransaction remote : cardProvider.listTransactions(card.getProviderCardId())) {
            cardTransactionRepository
                    .findByCardIdAndProviderTransactionId(card.getId(), remote.providerTransactionId())
                    .orElseGet(() -> {
                        CardTransaction tx = new CardTransaction();
                        tx.setCardId(card.getId());
                        tx.setUserId(userId);
                        tx.setProviderTransactionId(remote.providerTransactionId());
                        tx.setEntryType(remote.entryType());
                        tx.setStatus(remote.status());
                        tx.setAmount(remote.amount());
                        tx.setCurrencyCode(remote.currencyCode());
                        tx.setMerchantName(remote.merchantName());
                        tx.setOccurredAt(remote.occurredAt());
                        return cardTransactionRepository.save(tx);
                    });
        }
        return cardTransactionRepository
                .findByCardIdAndUserIdOrderByOccurredAtDesc(cardId, userId, pageable)
                .map(this::toTxResponse);
    }

    /** Admin inventory — no ownership check. */
    @Transactional(readOnly = true)
    public Page<AdminCardResponse> adminList(UUID userId, CardStatus status, Pageable pageable) {
        Specification<Card> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (userId != null) {
                predicates.add(cb.equal(root.get("userId"), userId));
            }
            if (status != null) {
                predicates.add(cb.equal(root.get("status"), status));
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };
        return cardRepository.findAll(spec, pageable).map(this::toAdminCardResponse);
    }

    /** Admin inventory — no ownership check. */
    @Transactional(readOnly = true)
    public AdminCardResponse adminGet(UUID cardId) {
        return toAdminCardResponse(requireCard(cardId));
    }

    /** Admin inventory — local card txs only (no provider sync). */
    @Transactional(readOnly = true)
    public Page<CardTransactionResponse> adminTransactions(UUID cardId, Pageable pageable) {
        requireCard(cardId);
        return cardTransactionRepository
                .findByCardIdOrderByOccurredAtDesc(cardId, pageable)
                .map(this::toTxResponse);
    }

    /** Admin block — same rules as owner block, without ownership check. */
    @Transactional
    public AdminCardResponse adminBlock(UUID cardId) {
        Card card = requireCard(cardId);
        if (card.getStatus() == CardStatus.CLOSED) {
            throw new BusinessException("CARD_CLOSED", "Closed card cannot be blocked", HttpStatus.CONFLICT);
        }
        if (card.getStatus() == CardStatus.BLOCKED) {
            return toAdminCardResponse(card);
        }
        cardProvider.blockCard(card.getProviderCardId());
        String old = String.valueOf(card.getStatus());
        card.setStatus(CardStatus.BLOCKED);
        cardRepository.save(card);
        auditRecorder.record(AuditRecord.builder("CARD_BLOCK")
                .entity("Card:" + card.getId())
                .userRef(card.getUserId())
                .oldValue("status=" + old)
                .newValue("status=BLOCKED")
                .build());
        return toAdminCardResponse(card);
    }

    /** Admin unblock — same rules as owner unblock, without ownership check. */
    @Transactional
    public AdminCardResponse adminUnblock(UUID cardId) {
        Card card = requireCard(cardId);
        if (card.getStatus() != CardStatus.BLOCKED) {
            throw new BusinessException(
                    "CARD_NOT_BLOCKED",
                    "Only blocked cards can be unblocked",
                    HttpStatus.CONFLICT);
        }
        cardProvider.unblockCard(card.getProviderCardId());
        card.setStatus(CardStatus.ACTIVE);
        cardRepository.save(card);
        auditRecorder.record(AuditRecord.builder("CARD_UNBLOCK")
                .entity("Card:" + card.getId())
                .userRef(card.getUserId())
                .oldValue("status=BLOCKED")
                .newValue("status=ACTIVE")
                .build());
        return toAdminCardResponse(card);
    }

    private Card requireCard(UUID cardId) {
        return cardRepository.findById(cardId)
                .orElseThrow(() -> new ResourceNotFoundException("Card not found"));
    }

    private Card requireOwned(UUID userId, UUID cardId) {
        return cardRepository.findByIdAndUserId(cardId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Card not found"));
    }

    private CardResponse toCardResponse(Card card) {
        return new CardResponse(
                card.getId(),
                card.getWalletId(),
                card.getProviderName(),
                card.getProviderCardId(),
                card.getLastFour(),
                card.getBrand(),
                card.getCurrencyCode(),
                card.getStatus(),
                toInteger(card.getExpiryMonth()),
                toInteger(card.getExpiryYear()),
                card.getCardholderName(),
                card.getCreatedAt());
    }

    private AdminCardResponse toAdminCardResponse(Card card) {
        return new AdminCardResponse(
                card.getId(),
                card.getUserId(),
                card.getWalletId(),
                card.getProviderName(),
                card.getProviderCardId(),
                card.getLastFour(),
                card.getBrand(),
                card.getCurrencyCode(),
                card.getStatus(),
                toInteger(card.getExpiryMonth()),
                toInteger(card.getExpiryYear()),
                card.getCardholderName(),
                card.getCreatedAt());
    }

    private static Short toShort(Integer value) {
        return value == null ? null : value.shortValue();
    }

    private static Integer toInteger(Short value) {
        return value == null ? null : value.intValue();
    }

    private CardTransactionResponse toTxResponse(CardTransaction tx) {
        return new CardTransactionResponse(
                tx.getId(),
                tx.getCardId(),
                tx.getProviderTransactionId(),
                tx.getEntryType(),
                tx.getStatus(),
                tx.getAmount(),
                tx.getCurrencyCode(),
                tx.getMerchantName(),
                tx.getOccurredAt(),
                tx.getLedgerEntryId(),
                tx.getFailureReason(),
                tx.getCreatedAt());
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
}
