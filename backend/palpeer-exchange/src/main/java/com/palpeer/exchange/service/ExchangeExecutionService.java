package com.palpeer.exchange.service;

import com.palpeer.common.exception.BusinessException;
import com.palpeer.common.exception.ResourceNotFoundException;
import com.palpeer.exchange.domain.ExchangeQuote;
import com.palpeer.exchange.domain.ExchangeQuoteStatus;
import com.palpeer.exchange.domain.ExchangeTransaction;
import com.palpeer.exchange.domain.ExchangeTransactionStatus;
import com.palpeer.exchange.repository.ExchangeQuoteRepository;
import com.palpeer.exchange.repository.ExchangeTransactionRepository;
import com.palpeer.exchange.web.dto.ExecuteExchangeRequest;
import com.palpeer.exchange.web.dto.ExchangeTransactionResponse;
import com.palpeer.ledger.domain.LedgerEntry;
import com.palpeer.ledger.domain.LedgerEntryType;
import com.palpeer.ledger.service.LedgerPostingRequest;
import com.palpeer.ledger.service.LedgerService;
import java.time.Instant;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ExchangeExecutionService {

    private final ExchangeQuoteRepository exchangeQuoteRepository;
    private final ExchangeTransactionRepository exchangeTransactionRepository;
    private final LedgerService ledgerService;

    @Transactional
    public ExchangeTransactionResponse execute(UUID userId, String idempotencyKey, ExecuteExchangeRequest request) {
        if (idempotencyKey == null || idempotencyKey.isBlank()) {
            throw new BusinessException(
                    "IDEMPOTENCY_KEY_REQUIRED",
                    "Idempotency-Key header is required",
                    HttpStatus.BAD_REQUEST);
        }

        return exchangeTransactionRepository.findByIdempotencyKey(idempotencyKey)
                .map(existing -> assertReplay(existing, userId, request.quoteId()))
                .orElseGet(() -> createAndExecute(userId, idempotencyKey, request.quoteId()));
    }

    @Transactional(readOnly = true)
    public ExchangeTransactionResponse get(UUID userId, UUID exchangeId) {
        return toResponse(exchangeTransactionRepository.findByIdAndUserId(exchangeId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Exchange transaction not found")));
    }

    private ExchangeTransactionResponse createAndExecute(UUID userId, String idempotencyKey, UUID quoteId) {
        ExchangeQuote quote = exchangeQuoteRepository.findByIdAndUserIdForUpdate(quoteId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Exchange quote not found"));

        if (quote.getStatus() != ExchangeQuoteStatus.OPEN) {
            throw new BusinessException(
                    "EXCHANGE_QUOTE_NOT_OPEN",
                    "Quote is not open: " + quote.getStatus(),
                    HttpStatus.CONFLICT);
        }
        if (quote.getExpiresAt().isBefore(Instant.now())) {
            quote.setStatus(ExchangeQuoteStatus.EXPIRED);
            exchangeQuoteRepository.save(quote);
            throw new BusinessException("EXCHANGE_QUOTE_EXPIRED", "Quote has expired", HttpStatus.CONFLICT);
        }

        ExchangeTransaction tx = new ExchangeTransaction();
        tx.setUserId(userId);
        tx.setQuoteId(quote.getId());
        tx.setSourceWalletId(quote.getSourceWalletId());
        tx.setTargetWalletId(quote.getTargetWalletId());
        tx.setSourceAmount(quote.getSourceAmount());
        tx.setTargetAmount(quote.getTargetAmount());
        tx.setAppliedRate(quote.getAppliedRate());
        tx.setStatus(ExchangeTransactionStatus.INITIATED);
        tx.setIdempotencyKey(idempotencyKey);

        try {
            exchangeTransactionRepository.saveAndFlush(tx);
        } catch (DataIntegrityViolationException ex) {
            return exchangeTransactionRepository.findByIdempotencyKey(idempotencyKey)
                    .map(existing -> assertReplay(existing, userId, quoteId))
                    .orElseThrow(() -> ex);
        }

        try {
            LedgerEntry debit = ledgerService.post(new LedgerPostingRequest(
                    quote.getSourceWalletId(),
                    LedgerEntryType.DEBIT,
                    quote.getSourceAmount(),
                    "exchange:" + tx.getId() + ":debit",
                    "EXCHANGE",
                    tx.getId().toString(),
                    "Instant exchange debit"
            ));
            LedgerEntry credit = ledgerService.post(new LedgerPostingRequest(
                    quote.getTargetWalletId(),
                    LedgerEntryType.CREDIT,
                    quote.getTargetAmount(),
                    "exchange:" + tx.getId() + ":credit",
                    "EXCHANGE",
                    tx.getId().toString(),
                    "Instant exchange credit"
            ));

            tx.setDebitLedgerEntryId(debit.getId());
            tx.setCreditLedgerEntryId(credit.getId());
            tx.setStatus(ExchangeTransactionStatus.SUCCESS);
            exchangeTransactionRepository.save(tx);

            quote.setStatus(ExchangeQuoteStatus.EXECUTED);
            exchangeQuoteRepository.save(quote);
            return toResponse(tx);
        } catch (RuntimeException ex) {
            tx.setStatus(ExchangeTransactionStatus.FAILED);
            tx.setFailureReason(ex.getMessage());
            exchangeTransactionRepository.save(tx);
            throw ex;
        }
    }

    private ExchangeTransactionResponse assertReplay(ExchangeTransaction existing, UUID userId, UUID quoteId) {
        if (!existing.getUserId().equals(userId) || !existing.getQuoteId().equals(quoteId)) {
            throw new BusinessException(
                    "EXCHANGE_IDEMPOTENCY_CONFLICT",
                    "Idempotency key already used with different exchange payload",
                    HttpStatus.CONFLICT);
        }
        return toResponse(existing);
    }

    private ExchangeTransactionResponse toResponse(ExchangeTransaction tx) {
        return new ExchangeTransactionResponse(
                tx.getId(),
                tx.getQuoteId(),
                tx.getSourceWalletId(),
                tx.getTargetWalletId(),
                tx.getSourceAmount(),
                tx.getTargetAmount(),
                tx.getAppliedRate(),
                tx.getStatus(),
                tx.getIdempotencyKey(),
                tx.getDebitLedgerEntryId(),
                tx.getCreditLedgerEntryId(),
                tx.getFailureReason(),
                tx.getCreatedAt()
        );
    }
}
