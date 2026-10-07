package com.palpeer.p2p.service;

import com.palpeer.common.exception.BusinessException;
import com.palpeer.common.exception.ResourceNotFoundException;
import com.palpeer.currency.service.CurrencyService;
import com.palpeer.p2p.domain.P2PFeeTier;
import com.palpeer.p2p.domain.P2PFeeType;
import com.palpeer.p2p.repository.P2PFeeTierRepository;
import com.palpeer.p2p.web.dto.P2PFeeTierResponse;
import com.palpeer.p2p.web.dto.UpsertP2PFeeTierRequest;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class P2PFeeTierService {

    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);

    private final P2PFeeTierRepository p2PFeeTierRepository;
    private final CurrencyService currencyService;

    @Transactional(readOnly = true)
    public List<P2PFeeTierResponse> listAll() {
        return p2PFeeTierRepository.findAllByOrderByBaseCurrencyCodeAscQuoteCurrencyCodeAscMinAmountAsc()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public P2PFeeTierResponse create(UpsertP2PFeeTierRequest request) {
        P2PFeeTier tier = new P2PFeeTier();
        apply(tier, request);
        p2PFeeTierRepository.save(tier);
        return toResponse(tier);
    }

    @Transactional
    public P2PFeeTierResponse update(UUID id, UpsertP2PFeeTierRequest request) {
        P2PFeeTier tier = p2PFeeTierRepository
                .findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("P2P fee tier not found"));
        apply(tier, request);
        p2PFeeTierRepository.save(tier);
        return toResponse(tier);
    }

    @Transactional
    public void delete(UUID id) {
        if (!p2PFeeTierRepository.existsById(id)) {
            throw new ResourceNotFoundException("P2P fee tier not found");
        }
        p2PFeeTierRepository.deleteById(id);
    }

    /**
     * Resolve the fee for a P2P amount on a pair. Returns zero when no matching active tier exists.
     */
    @Transactional(readOnly = true)
    public BigDecimal resolveFee(String baseCurrencyCode, String quoteCurrencyCode, BigDecimal amount) {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            return BigDecimal.ZERO;
        }
        String base = normalize(baseCurrencyCode);
        String quote = normalize(quoteCurrencyCode);
        return p2PFeeTierRepository
                .findByBaseCurrencyCodeIgnoreCaseAndQuoteCurrencyCodeIgnoreCaseAndActiveTrueOrderByMinAmountAsc(
                        base, quote)
                .stream()
                .filter(tier -> matchesAmount(tier, amount))
                .findFirst()
                .map(tier -> computeFee(tier, amount))
                .orElse(BigDecimal.ZERO);
    }

    private void apply(P2PFeeTier tier, UpsertP2PFeeTierRequest request) {
        String base = normalize(request.baseCurrencyCode());
        String quote = normalize(request.quoteCurrencyCode());
        if (base.equals(quote)) {
            throw new BusinessException(
                    "P2P_FEE_SAME_CURRENCY", "Base and quote currency must differ", HttpStatus.BAD_REQUEST);
        }
        currencyService.requireExists(base);
        currencyService.requireExists(quote);
        validateValue(request.feeType(), request.feeValue());
        validateRange(request.minAmount(), request.maxAmount());

        boolean active = request.active() == null || request.active();
        if (active) {
            assertNoOverlap(tier.getId(), base, quote, request.minAmount(), request.maxAmount());
        }

        tier.setBaseCurrencyCode(base);
        tier.setQuoteCurrencyCode(quote);
        tier.setFeeType(request.feeType());
        tier.setFeeValue(request.feeValue());
        tier.setMinAmount(request.minAmount());
        tier.setMaxAmount(request.maxAmount());
        tier.setActive(active);
    }

    private void assertNoOverlap(
            UUID excludeId, String base, String quote, BigDecimal minAmount, BigDecimal maxAmount) {
        List<P2PFeeTier> siblings =
                p2PFeeTierRepository.findByBaseCurrencyCodeIgnoreCaseAndQuoteCurrencyCodeIgnoreCase(base, quote);
        for (P2PFeeTier other : siblings) {
            if (!other.isActive()) {
                continue;
            }
            if (excludeId != null && excludeId.equals(other.getId())) {
                continue;
            }
            if (rangesOverlap(minAmount, maxAmount, other.getMinAmount(), other.getMaxAmount())) {
                throw new BusinessException(
                        "P2P_FEE_RANGE_OVERLAP",
                        "Amount range overlaps an existing active tier for " + base + "/" + quote,
                        HttpStatus.BAD_REQUEST);
            }
        }
    }

    private static boolean rangesOverlap(
            BigDecimal aMin, BigDecimal aMax, BigDecimal bMin, BigDecimal bMax) {
        BigDecimal aHi = aMax == null ? null : aMax;
        BigDecimal bHi = bMax == null ? null : bMax;
        // [aMin, aHi] overlaps [bMin, bHi] when aMin <= bHi and bMin <= aHi (null hi = +inf)
        boolean aBeforeBEnd = bHi == null || aMin.compareTo(bHi) <= 0;
        boolean bBeforeAEnd = aHi == null || bMin.compareTo(aHi) <= 0;
        return aBeforeBEnd && bBeforeAEnd;
    }

    private static boolean matchesAmount(P2PFeeTier tier, BigDecimal amount) {
        if (amount.compareTo(tier.getMinAmount()) < 0) {
            return false;
        }
        return tier.getMaxAmount() == null || amount.compareTo(tier.getMaxAmount()) <= 0;
    }

    private static BigDecimal computeFee(P2PFeeTier tier, BigDecimal amount) {
        if (tier.getFeeType() == P2PFeeType.FIXED) {
            return tier.getFeeValue();
        }
        return amount.multiply(tier.getFeeValue()).divide(HUNDRED, 12, RoundingMode.HALF_UP);
    }

    private static void validateValue(P2PFeeType feeType, BigDecimal feeValue) {
        if (feeType == P2PFeeType.PERCENTAGE && feeValue.compareTo(HUNDRED) > 0) {
            throw new BusinessException(
                    "P2P_FEE_PCT_INVALID", "Percentage fee cannot exceed 100", HttpStatus.BAD_REQUEST);
        }
    }

    private static void validateRange(BigDecimal minAmount, BigDecimal maxAmount) {
        if (maxAmount != null && maxAmount.compareTo(minAmount) < 0) {
            throw new BusinessException(
                    "P2P_FEE_RANGE_INVALID",
                    "maxAmount must be greater than or equal to minAmount",
                    HttpStatus.BAD_REQUEST);
        }
    }

    private static String normalize(String code) {
        return code.trim().toUpperCase(Locale.ROOT);
    }

    private P2PFeeTierResponse toResponse(P2PFeeTier tier) {
        return new P2PFeeTierResponse(
                tier.getId(),
                tier.getBaseCurrencyCode(),
                tier.getQuoteCurrencyCode(),
                tier.getFeeType(),
                tier.getFeeValue(),
                tier.getMinAmount(),
                tier.getMaxAmount(),
                tier.isActive());
    }
}
