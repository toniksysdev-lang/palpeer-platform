package com.palpeer.currency.service;

import com.palpeer.common.audit.AuditRecord;
import com.palpeer.common.audit.AuditRecorder;
import com.palpeer.common.exception.BusinessException;
import com.palpeer.common.exception.ResourceNotFoundException;
import com.palpeer.currency.domain.ExchangeRate;
import com.palpeer.currency.domain.RateApprovalStatus;
import com.palpeer.currency.domain.RateChannel;
import com.palpeer.currency.repository.ExchangeRateRepository;
import com.palpeer.currency.web.dto.CreateExchangeRateRequest;
import com.palpeer.currency.web.dto.ExchangeRateResponse;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ExchangeRateService {

    private final ExchangeRateRepository exchangeRateRepository;
    private final CurrencyService currencyService;
    private final AuditRecorder auditRecorder;

    @Transactional(readOnly = true)
    public ExchangeRateResponse getLatest(
            String baseCurrencyCode, String quoteCurrencyCode, Instant asOf, RateChannel channel) {
        RateChannel effectiveChannel = channel == null ? RateChannel.SWAP : channel;
        Instant effectiveAsOf = asOf == null ? Instant.now() : asOf;
        return exchangeRateRepository
                .findLatestPublishedEffective(
                        normalize(baseCurrencyCode), normalize(quoteCurrencyCode), effectiveChannel, effectiveAsOf)
                .map(this::toResponse)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "No exchange rate for " + baseCurrencyCode + "/" + quoteCurrencyCode));
    }

    @Transactional(readOnly = true)
    public List<ExchangeRateResponse> history(String baseCurrencyCode, String quoteCurrencyCode, RateChannel channel) {
        RateChannel effectiveChannel = channel == null ? RateChannel.SWAP : channel;
        return exchangeRateRepository
                .findPublishedHistory(
                        normalize(baseCurrencyCode),
                        normalize(quoteCurrencyCode),
                        effectiveChannel,
                        RateApprovalStatus.APPROVED)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<ExchangeRateResponse> listHistory(String baseCurrencyCode, String quoteCurrencyCode, RateChannel channel) {
        return exchangeRateRepository
                .findAdminHistory(normalize(baseCurrencyCode), normalize(quoteCurrencyCode), channel)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    /** Latest effective published rate for every base/quote pair in a channel. */
    @Transactional(readOnly = true)
    public List<ExchangeRateResponse> latestForAllPairs(RateChannel channel) {
        RateChannel effectiveChannel = channel == null ? RateChannel.SWAP : channel;
        Map<String, ExchangeRate> latest = new LinkedHashMap<>();
        for (ExchangeRate rate : exchangeRateRepository.findPublishedEffectiveByChannel(
                effectiveChannel, RateApprovalStatus.APPROVED, Instant.now())) {
            String pair = normalize(rate.getBaseCurrencyCode()) + "/" + normalize(rate.getQuoteCurrencyCode());
            latest.putIfAbsent(pair, rate);
        }
        return latest.values().stream()
                .sorted(Comparator.comparing(ExchangeRate::getBaseCurrencyCode)
                        .thenComparing(ExchangeRate::getQuoteCurrencyCode))
                .map(this::toResponse)
                .toList();
    }

    /** Admin: latest effective row per pair (and channel when filtered), any activation/approval state. */
    @Transactional(readOnly = true)
    public List<ExchangeRateResponse> listAdminLatest(RateChannel channel) {
        Map<String, ExchangeRate> latest = new LinkedHashMap<>();
        for (ExchangeRate rate : exchangeRateRepository.findAdminEffectiveRates(Instant.now(), channel)) {
            String key = normalize(rate.getBaseCurrencyCode())
                    + "/"
                    + normalize(rate.getQuoteCurrencyCode())
                    + ":"
                    + rate.getChannel();
            latest.putIfAbsent(key, rate);
        }
        return latest.values().stream()
                .sorted(Comparator.comparing(ExchangeRate::getBaseCurrencyCode)
                        .thenComparing(ExchangeRate::getQuoteCurrencyCode)
                        .thenComparing(ExchangeRate::getChannel))
                .map(this::toResponse)
                .toList();
    }

    /**
     * Publish a rate (admin: rates:write).
     * CONTRACT_PENDING (P4-03): buy vs sell semantics (platform buy/sell perspective).
     */
    @Transactional
    public ExchangeRateResponse create(CreateExchangeRateRequest request) {
        String base = normalize(request.baseCurrencyCode());
        String quote = normalize(request.quoteCurrencyCode());
        RateChannel channel = request.channel() == null ? RateChannel.SWAP : request.channel();

        if (base.equals(quote)) {
            throw new BusinessException("RATE_SAME_CURRENCY", "Base and quote currency must differ", HttpStatus.BAD_REQUEST);
        }

        currencyService.requireExists(base);
        currencyService.requireExists(quote);

        if (request.buyRate().compareTo(BigDecimal.ZERO) <= 0
                || request.sellRate().compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessException("RATE_INVALID", "Rates must be positive", HttpStatus.BAD_REQUEST);
        }

        if (exchangeRateRepository.existsByBaseCurrencyCodeIgnoreCaseAndQuoteCurrencyCodeIgnoreCaseAndChannelAndEffectiveDate(
                base, quote, channel, request.effectiveDate())) {
            throw new BusinessException(
                    "RATE_EXISTS",
                    "Rate already exists for this pair, channel, and effectiveDate",
                    HttpStatus.CONFLICT);
        }

        boolean submitForApproval = Boolean.TRUE.equals(request.submitForApproval());
        RateApprovalStatus approvalStatus =
                submitForApproval ? RateApprovalStatus.PENDING : RateApprovalStatus.APPROVED;

        ExchangeRate rate = new ExchangeRate();
        rate.setBaseCurrencyCode(base);
        rate.setQuoteCurrencyCode(quote);
        rate.setChannel(channel);
        rate.setActive(true);
        rate.setApprovalStatus(approvalStatus);
        rate.setBuyRate(request.buyRate());
        rate.setSellRate(request.sellRate());
        rate.setEffectiveDate(request.effectiveDate());
        exchangeRateRepository.save(rate);
        auditRecorder.record(AuditRecord.builder("ADMIN_RATE_PUBLISH")
                .entity("ExchangeRate:" + rate.getId())
                .newValue("pair=" + base + "/" + quote
                        + ";channel=" + channel
                        + ";approval=" + approvalStatus
                        + ";buy=" + rate.getBuyRate()
                        + ";sell=" + rate.getSellRate()
                        + ";effective=" + rate.getEffectiveDate())
                .build());
        return toResponse(rate);
    }

    @Transactional
    public ExchangeRateResponse setActive(UUID id, boolean active) {
        ExchangeRate rate = requireRate(id);
        rate.setActive(active);
        exchangeRateRepository.save(rate);
        auditRecorder.record(AuditRecord.builder(active ? "ADMIN_RATE_ACTIVATE" : "ADMIN_RATE_DEACTIVATE")
                .entity("ExchangeRate:" + rate.getId())
                .newValue("active=" + active)
                .build());
        return toResponse(rate);
    }

    @Transactional
    public ExchangeRateResponse setApprovalStatus(UUID id, RateApprovalStatus status) {
        if (status != RateApprovalStatus.APPROVED && status != RateApprovalStatus.REJECTED) {
            throw new BusinessException(
                    "RATE_APPROVAL_INVALID",
                    "Only APPROVED or REJECTED are allowed",
                    HttpStatus.BAD_REQUEST);
        }
        ExchangeRate rate = requireRate(id);
        rate.setApprovalStatus(status);
        exchangeRateRepository.save(rate);
        auditRecorder.record(AuditRecord.builder(
                        status == RateApprovalStatus.APPROVED ? "ADMIN_RATE_APPROVE" : "ADMIN_RATE_REJECT")
                .entity("ExchangeRate:" + rate.getId())
                .newValue("approvalStatus=" + status)
                .build());
        return toResponse(rate);
    }

    /**
     * Permanently deletes a swap/P2P pair: every exchange_rates row for the same
     * base/quote/channel as the given rate id (so the pair disappears from admin latest).
     */
    @Transactional
    public void deletePair(UUID id) {
        ExchangeRate rate = requireRate(id);
        String base = normalize(rate.getBaseCurrencyCode());
        String quote = normalize(rate.getQuoteCurrencyCode());
        RateChannel channel = rate.getChannel();
        long removed = exchangeRateRepository
                .deleteByBaseCurrencyCodeIgnoreCaseAndQuoteCurrencyCodeIgnoreCaseAndChannel(
                        base, quote, channel);
        auditRecorder.record(AuditRecord.builder("ADMIN_RATE_PAIR_DELETE")
                .entity("ExchangeRatePair:" + base + "/" + quote + ":" + channel)
                .oldValue("seedRateId=" + id + ";rows=" + removed)
                .newValue("deleted")
                .build());
    }

    private ExchangeRate requireRate(UUID id) {
        return exchangeRateRepository
                .findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Exchange rate not found"));
    }

    private static String normalize(String code) {
        return code.trim().toUpperCase(Locale.ROOT);
    }

    private ExchangeRateResponse toResponse(ExchangeRate rate) {
        return new ExchangeRateResponse(
                rate.getId(),
                rate.getBaseCurrencyCode(),
                rate.getQuoteCurrencyCode(),
                rate.getChannel(),
                rate.isActive(),
                rate.getApprovalStatus(),
                rate.getBuyRate(),
                rate.getSellRate(),
                rate.getEffectiveDate()
        );
    }
}
