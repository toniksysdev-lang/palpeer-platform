package com.palpeer.p2p.service;

import com.palpeer.common.exception.BusinessException;
import com.palpeer.common.exception.ResourceNotFoundException;
import com.palpeer.currency.service.CurrencyService;
import com.palpeer.p2p.domain.P2PRateBounds;
import com.palpeer.p2p.repository.P2PRateBoundsRepository;
import com.palpeer.p2p.web.dto.P2PRateBoundsResponse;
import com.palpeer.p2p.web.dto.UpsertP2PRateBoundsRequest;
import java.math.BigDecimal;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class P2PRateBoundsService {

    private final P2PRateBoundsRepository p2PRateBoundsRepository;
    private final CurrencyService currencyService;

    @Transactional(readOnly = true)
    public List<P2PRateBoundsResponse> listAll() {
        return p2PRateBoundsRepository.findAllByOrderByBaseCurrencyCodeAscQuoteCurrencyCodeAsc().stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public P2PRateBoundsResponse upsert(UpsertP2PRateBoundsRequest request) {
        String base = normalize(request.baseCurrencyCode());
        String quote = normalize(request.quoteCurrencyCode());
        if (base.equals(quote)) {
            throw new BusinessException(
                    "P2P_BOUNDS_SAME_CURRENCY", "Base and quote currency must differ", HttpStatus.BAD_REQUEST);
        }
        currencyService.requireExists(base);
        currencyService.requireExists(quote);
        validateMinMax(request.minRate(), request.maxRate());

        P2PRateBounds bounds = p2PRateBoundsRepository
                .findByBaseCurrencyCodeIgnoreCaseAndQuoteCurrencyCodeIgnoreCase(base, quote)
                .orElseGet(P2PRateBounds::new);
        bounds.setBaseCurrencyCode(base);
        bounds.setQuoteCurrencyCode(quote);
        bounds.setMinRate(request.minRate());
        bounds.setMaxRate(request.maxRate());
        p2PRateBoundsRepository.save(bounds);
        return toResponse(bounds);
    }

    @Transactional
    public void delete(UUID id) {
        if (!p2PRateBoundsRepository.existsById(id)) {
            throw new ResourceNotFoundException("P2P rate bounds not found");
        }
        p2PRateBoundsRepository.deleteById(id);
    }

    @Transactional(readOnly = true)
    public void requireRateWithinBounds(String baseCurrencyCode, String quoteCurrencyCode, BigDecimal rate) {
        if (rate == null) {
            return;
        }
        p2PRateBoundsRepository
                .findByBaseCurrencyCodeIgnoreCaseAndQuoteCurrencyCodeIgnoreCase(
                        normalize(baseCurrencyCode), normalize(quoteCurrencyCode))
                .ifPresent(bounds -> {
                    if (rate.compareTo(bounds.getMinRate()) < 0 || rate.compareTo(bounds.getMaxRate()) > 0) {
                        throw new BusinessException(
                                "P2P_RATE_OUT_OF_BOUNDS",
                                "Rate must be between "
                                        + bounds.getMinRate()
                                        + " and "
                                        + bounds.getMaxRate()
                                        + " for "
                                        + bounds.getBaseCurrencyCode()
                                        + "/"
                                        + bounds.getQuoteCurrencyCode(),
                                HttpStatus.BAD_REQUEST);
                    }
                });
    }

    private static void validateMinMax(BigDecimal minRate, BigDecimal maxRate) {
        if (minRate.compareTo(maxRate) > 0) {
            throw new BusinessException(
                    "P2P_BOUNDS_INVALID", "minRate must be less than or equal to maxRate", HttpStatus.BAD_REQUEST);
        }
    }

    private static String normalize(String code) {
        return code.trim().toUpperCase(Locale.ROOT);
    }

    private P2PRateBoundsResponse toResponse(P2PRateBounds bounds) {
        return new P2PRateBoundsResponse(
                bounds.getId(),
                bounds.getBaseCurrencyCode(),
                bounds.getQuoteCurrencyCode(),
                bounds.getMinRate(),
                bounds.getMaxRate());
    }
}
