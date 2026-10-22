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
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class P2PFeeTierService {

    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);
    private static final int FEE_MATH_SCALE = 12;

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
     * Resolve buyer platform fee in the request <strong>base</strong> currency.
     *
     * <p>Admin tiers follow Configured P2P bounds pairs (e.g. CAD/NGN). Sell posts may store the
     * opposite orientation (NGN/CAD). Matching tries the request pair first, then the inverse pair
     * using {@code rate} (quote units per 1 base) to convert amount ranges and FIXED fees.
     *
     * @param rate quote-per-base for the request; required to match inverse tiers (may be null)
     */
    @Transactional(readOnly = true)
    public BigDecimal resolveFee(
            String baseCurrencyCode, String quoteCurrencyCode, BigDecimal amount, BigDecimal rate) {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            return BigDecimal.ZERO;
        }
        String base = normalize(baseCurrencyCode);
        String quote = normalize(quoteCurrencyCode);

        Optional<BigDecimal> direct = matchFee(base, quote, amount, amount, false, null);
        if (direct.isPresent()) {
            return direct.get();
        }

        if (rate == null || rate.compareTo(BigDecimal.ZERO) <= 0) {
            return BigDecimal.ZERO;
        }
        BigDecimal amountInTierBase =
                amount.multiply(rate).setScale(FEE_MATH_SCALE, RoundingMode.HALF_EVEN);
        return matchFee(quote, base, amountInTierBase, amount, true, rate).orElse(BigDecimal.ZERO);
    }

    private Optional<BigDecimal> matchFee(
            String tierBase,
            String tierQuote,
            BigDecimal amountForRange,
            BigDecimal requestBaseAmount,
            boolean reverse,
            BigDecimal rate) {
        return p2PFeeTierRepository
                .findByBaseCurrencyCodeIgnoreCaseAndQuoteCurrencyCodeIgnoreCaseAndActiveTrueOrderByMinAmountAsc(
                        tierBase, tierQuote)
                .stream()
                .filter(tier -> matchesAmount(tier, amountForRange))
                .findFirst()
                .map(tier -> computeFeeInRequestBase(tier, requestBaseAmount, reverse, rate));
    }

    private static BigDecimal computeFeeInRequestBase(
            P2PFeeTier tier, BigDecimal requestBaseAmount, boolean reverse, BigDecimal rate) {
        if (tier.getFeeType() == P2PFeeType.PERCENTAGE) {
            return requestBaseAmount
                    .multiply(tier.getFeeValue())
                    .divide(HUNDRED, FEE_MATH_SCALE, RoundingMode.HALF_UP);
        }
        if (!reverse) {
            return tier.getFeeValue();
        }
        return tier.getFeeValue().divide(rate, FEE_MATH_SCALE, RoundingMode.HALF_EVEN);
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
        BigDecimal aHi = aMax;
        BigDecimal bHi = bMax;
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
