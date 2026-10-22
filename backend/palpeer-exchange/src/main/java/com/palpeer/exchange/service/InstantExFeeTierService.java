package com.palpeer.exchange.service;

import com.palpeer.common.exception.BusinessException;
import com.palpeer.common.exception.ResourceNotFoundException;
import com.palpeer.currency.service.CurrencyService;
import com.palpeer.exchange.domain.InstantExFeeTier;
import com.palpeer.exchange.domain.InstantExFeeType;
import com.palpeer.exchange.repository.InstantExFeeTierRepository;
import com.palpeer.exchange.web.dto.InstantExFeeTierResponse;
import com.palpeer.exchange.web.dto.UpsertInstantExFeeTierRequest;
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
public class InstantExFeeTierService {

    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);
    private static final int FEE_MATH_SCALE = 12;

    private final InstantExFeeTierRepository instantExFeeTierRepository;
    private final CurrencyService currencyService;

    @Transactional(readOnly = true)
    public List<InstantExFeeTierResponse> listAll() {
        return instantExFeeTierRepository.findAllByOrderByBaseCurrencyCodeAscQuoteCurrencyCodeAscMinAmountAsc()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public InstantExFeeTierResponse create(UpsertInstantExFeeTierRequest request) {
        InstantExFeeTier tier = new InstantExFeeTier();
        apply(tier, request);
        instantExFeeTierRepository.save(tier);
        return toResponse(tier);
    }

    @Transactional
    public InstantExFeeTierResponse update(UUID id, UpsertInstantExFeeTierRequest request) {
        InstantExFeeTier tier = instantExFeeTierRepository
                .findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("InstantEX fee tier not found"));
        apply(tier, request);
        instantExFeeTierRepository.save(tier);
        return toResponse(tier);
    }

    @Transactional
    public void delete(UUID id) {
        if (!instantExFeeTierRepository.existsById(id)) {
            throw new ResourceNotFoundException("InstantEX fee tier not found");
        }
        instantExFeeTierRepository.deleteById(id);
    }

    /**
     * Resolve InstantEX platform fee in <strong>source</strong> currency for a trade.
     *
     * <p>Admin tiers are stored against the published SWAP pair (e.g. CAD/NGN). They apply to
     * both directions: CAD→NGN matches directly; NGN→CAD matches the same tier after converting
     * the source amount into the tier base via {@code appliedRate} (target units per source unit).
     * Percentage fees always apply to the source amount; FIXED fees are converted into source
     * currency when the trade runs in the reverse direction.
     *
     * @return fee in source currency, or zero when no active tier matches
     */
    @Transactional(readOnly = true)
    public BigDecimal resolveFee(
            String sourceCurrencyCode,
            String targetCurrencyCode,
            BigDecimal sourceAmount,
            BigDecimal appliedRate) {
        if (sourceAmount == null || sourceAmount.compareTo(BigDecimal.ZERO) <= 0) {
            return BigDecimal.ZERO;
        }
        String source = normalize(sourceCurrencyCode);
        String target = normalize(targetCurrencyCode);

        Optional<BigDecimal> direct = matchFee(source, target, sourceAmount, sourceAmount, false, null);
        if (direct.isPresent()) {
            return direct.get();
        }

        if (appliedRate == null || appliedRate.compareTo(BigDecimal.ZERO) <= 0) {
            return BigDecimal.ZERO;
        }
        // Inverse: tier base is the trade target. Convert source → base for range matching.
        BigDecimal amountInTierBase =
                sourceAmount.multiply(appliedRate).setScale(FEE_MATH_SCALE, RoundingMode.HALF_EVEN);
        return matchFee(target, source, amountInTierBase, sourceAmount, true, appliedRate)
                .orElse(BigDecimal.ZERO);
    }

    /**
     * @param amountForRange amount in the tier's base currency (for min/max)
     * @param sourceAmount amount being sent (percentage base; always source currency)
     * @param reverse whether tier base is the trade target (FIXED must be converted)
     */
    private Optional<BigDecimal> matchFee(
            String tierBase,
            String tierQuote,
            BigDecimal amountForRange,
            BigDecimal sourceAmount,
            boolean reverse,
            BigDecimal appliedRate) {
        return instantExFeeTierRepository
                .findByBaseCurrencyCodeIgnoreCaseAndQuoteCurrencyCodeIgnoreCaseAndActiveTrueOrderByMinAmountAsc(
                        tierBase, tierQuote)
                .stream()
                .filter(tier -> matchesAmount(tier, amountForRange))
                .findFirst()
                .map(tier -> computeFeeInSource(tier, sourceAmount, reverse, appliedRate));
    }

    private static BigDecimal computeFeeInSource(
            InstantExFeeTier tier, BigDecimal sourceAmount, boolean reverse, BigDecimal appliedRate) {
        if (tier.getFeeType() == InstantExFeeType.PERCENTAGE) {
            return sourceAmount.multiply(tier.getFeeValue()).divide(HUNDRED, FEE_MATH_SCALE, RoundingMode.HALF_UP);
        }
        // FIXED is denominated in the tier base currency.
        if (!reverse) {
            return tier.getFeeValue();
        }
        return tier.getFeeValue().divide(appliedRate, FEE_MATH_SCALE, RoundingMode.HALF_EVEN);
    }

    private void apply(InstantExFeeTier tier, UpsertInstantExFeeTierRequest request) {
        String base = normalize(request.baseCurrencyCode());
        String quote = normalize(request.quoteCurrencyCode());
        if (base.equals(quote)) {
            throw new BusinessException(
                    "INSTANTEX_FEE_SAME_CURRENCY", "Base and quote currency must differ", HttpStatus.BAD_REQUEST);
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
        List<InstantExFeeTier> siblings =
                instantExFeeTierRepository.findByBaseCurrencyCodeIgnoreCaseAndQuoteCurrencyCodeIgnoreCase(base, quote);
        for (InstantExFeeTier other : siblings) {
            if (!other.isActive()) {
                continue;
            }
            if (excludeId != null && excludeId.equals(other.getId())) {
                continue;
            }
            if (rangesOverlap(minAmount, maxAmount, other.getMinAmount(), other.getMaxAmount())) {
                throw new BusinessException(
                        "INSTANTEX_FEE_RANGE_OVERLAP",
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

    private static boolean matchesAmount(InstantExFeeTier tier, BigDecimal amount) {
        if (amount.compareTo(tier.getMinAmount()) < 0) {
            return false;
        }
        return tier.getMaxAmount() == null || amount.compareTo(tier.getMaxAmount()) <= 0;
    }

    private static void validateValue(InstantExFeeType feeType, BigDecimal feeValue) {
        if (feeType == InstantExFeeType.PERCENTAGE && feeValue.compareTo(HUNDRED) > 0) {
            throw new BusinessException(
                    "INSTANTEX_FEE_PCT_INVALID", "Percentage fee cannot exceed 100", HttpStatus.BAD_REQUEST);
        }
    }

    private static void validateRange(BigDecimal minAmount, BigDecimal maxAmount) {
        if (maxAmount != null && maxAmount.compareTo(minAmount) < 0) {
            throw new BusinessException(
                    "INSTANTEX_FEE_RANGE_INVALID",
                    "maxAmount must be greater than or equal to minAmount",
                    HttpStatus.BAD_REQUEST);
        }
    }

    private static String normalize(String code) {
        return code.trim().toUpperCase(Locale.ROOT);
    }

    private InstantExFeeTierResponse toResponse(InstantExFeeTier tier) {
        return new InstantExFeeTierResponse(
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
