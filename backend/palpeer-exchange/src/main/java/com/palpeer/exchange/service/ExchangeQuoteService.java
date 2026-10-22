package com.palpeer.exchange.service;

import com.palpeer.common.exception.BusinessException;
import com.palpeer.common.exception.ResourceNotFoundException;
import com.palpeer.currency.domain.RateChannel;
import com.palpeer.currency.service.CurrencyService;
import com.palpeer.currency.service.ExchangeRateService;
import com.palpeer.currency.web.dto.CurrencyResponse;
import com.palpeer.currency.web.dto.ExchangeRateResponse;
import com.palpeer.exchange.domain.ExchangeQuote;
import com.palpeer.exchange.domain.ExchangeQuoteStatus;
import com.palpeer.exchange.math.FixedDecimalMoney;
import com.palpeer.exchange.repository.ExchangeQuoteRepository;
import com.palpeer.exchange.web.dto.ExchangeCalculateRequest;
import com.palpeer.exchange.web.dto.ExchangeCalculationResponse;
import com.palpeer.exchange.web.dto.ExchangeQuoteResponse;
import com.palpeer.wallet.domain.Wallet;
import com.palpeer.wallet.repository.WalletRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ExchangeQuoteService {

    private final WalletRepository walletRepository;
    private final CurrencyService currencyService;
    private final ExchangeRateService exchangeRateService;
    private final ExchangeQuoteRepository exchangeQuoteRepository;
    private final InstantExFeeTierService instantExFeeTierService;

    @Value("${palpeer.exchange.quote-ttl:60s}")
    private Duration quoteTtl;

    @Transactional(readOnly = true)
    public ExchangeCalculationResponse calculate(UUID userId, ExchangeCalculateRequest request) {
        CalculatedQuote calculated = calculateInternal(userId, request);
        FeeEstimate fee = estimateFee(calculated);
        return new ExchangeCalculationResponse(
                calculated.sourceWallet().getId(),
                calculated.targetWallet().getId(),
                calculated.sourceWallet().getCurrencyCode(),
                calculated.targetWallet().getCurrencyCode(),
                calculated.sourceAmount(),
                calculated.targetAmount(),
                calculated.appliedRate(),
                calculated.rateSide(),
                fee.amount(),
                fee.currencyCode());
    }

    @Transactional
    public ExchangeQuoteResponse preview(UUID userId, ExchangeCalculateRequest request) {
        CalculatedQuote calculated = calculateInternal(userId, request);

        ExchangeQuote quote = new ExchangeQuote();
        quote.setUserId(userId);
        quote.setSourceWalletId(calculated.sourceWallet().getId());
        quote.setTargetWalletId(calculated.targetWallet().getId());
        quote.setSourceCurrencyCode(calculated.sourceWallet().getCurrencyCode());
        quote.setTargetCurrencyCode(calculated.targetWallet().getCurrencyCode());
        quote.setSourceAmount(calculated.sourceAmount());
        quote.setTargetAmount(calculated.targetAmount());
        quote.setAppliedRate(calculated.appliedRate());
        quote.setRateSide(calculated.rateSide());
        quote.setExpiresAt(Instant.now().plus(quoteTtl));
        quote.setStatus(ExchangeQuoteStatus.OPEN);
        exchangeQuoteRepository.save(quote);
        return toQuoteResponse(quote);
    }

    private CalculatedQuote calculateInternal(UUID userId, ExchangeCalculateRequest request) {
        boolean hasSource = request.sourceAmount() != null;
        boolean hasTarget = request.targetAmount() != null;
        if (hasSource == hasTarget) {
            throw new BusinessException(
                    "EXCHANGE_AMOUNT_REQUIRED",
                    "Provide exactly one of sourceAmount or targetAmount",
                    HttpStatus.BAD_REQUEST);
        }

        Wallet source = walletRepository.findByIdAndUserId(request.sourceWalletId(), userId)
                .orElseThrow(() -> new ResourceNotFoundException("Source wallet not found"));
        Wallet target = walletRepository.findByIdAndUserId(request.targetWalletId(), userId)
                .orElseThrow(() -> new ResourceNotFoundException("Target wallet not found"));

        if (source.getId().equals(target.getId())) {
            throw new BusinessException("EXCHANGE_SAME_WALLET", "Source and target wallets must differ", HttpStatus.BAD_REQUEST);
        }
        if (source.getCurrencyCode().equalsIgnoreCase(target.getCurrencyCode())) {
            throw new BusinessException(
                    "EXCHANGE_SAME_CURRENCY",
                    "Source and target currencies must differ",
                    HttpStatus.BAD_REQUEST);
        }

        CurrencyResponse sourceCurrency = currencyService.getByCode(source.getCurrencyCode());
        CurrencyResponse targetCurrency = currencyService.getByCode(target.getCurrencyCode());
        RateSelection rate = selectRate(source.getCurrencyCode(), target.getCurrencyCode());

        BigDecimal sourceAmount;
        BigDecimal targetAmount;
        if (hasSource) {
            sourceAmount = FixedDecimalMoney.scaleAmount(request.sourceAmount(), sourceCurrency.precision());
            targetAmount = FixedDecimalMoney.convertSourceToTarget(
                    sourceAmount, rate.appliedRate(), targetCurrency.precision());
        } else {
            targetAmount = FixedDecimalMoney.scaleAmount(request.targetAmount(), targetCurrency.precision());
            sourceAmount = FixedDecimalMoney.convertTargetToSource(
                    targetAmount, rate.appliedRate(), sourceCurrency.precision());
        }

        if (sourceAmount.compareTo(BigDecimal.ZERO) <= 0 || targetAmount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessException("EXCHANGE_AMOUNT_INVALID", "Computed amounts must be positive", HttpStatus.BAD_REQUEST);
        }

        return new CalculatedQuote(source, target, sourceAmount, targetAmount, rate.appliedRate(), rate.rateSide());
    }

    /**
     * CONTRACT_PENDING (P7-01): buy vs sell rate selection.
     * Provisional: use sellRate for base=source, quote=target; else inverse of buyRate for opposite pair.
     * Uses optional lookup (not thrown 404) so a missing direct pair does not mark this
     * transaction rollback-only before the inverse rate is applied.
     */
    private RateSelection selectRate(String sourceCode, String targetCode) {
        Instant asOf = Instant.now();
        return exchangeRateService
                .findLatestOptional(sourceCode, targetCode, asOf, RateChannel.SWAP)
                .map(direct -> new RateSelection(direct.sellRate(), "SELL"))
                .orElseGet(() -> {
                    ExchangeRateResponse inverse = exchangeRateService
                            .findLatestOptional(targetCode, sourceCode, asOf, RateChannel.SWAP)
                            .orElseThrow(() -> new ResourceNotFoundException(
                                    "No exchange rate for " + sourceCode + "/" + targetCode));
                    // inverse: source/target = 1 / buyRate of target/source (provisional)
                    BigDecimal rate =
                            BigDecimal.ONE.divide(inverse.buyRate(), 12, FixedDecimalMoney.FX_ROUNDING);
                    return new RateSelection(rate, "INVERSE_BUY");
                });
    }

    private ExchangeQuoteResponse toQuoteResponse(ExchangeQuote quote) {
        FeeEstimate fee = scaledInstantExFee(
                quote.getSourceCurrencyCode(),
                quote.getTargetCurrencyCode(),
                quote.getSourceAmount(),
                quote.getAppliedRate());
        return new ExchangeQuoteResponse(
                quote.getId(),
                quote.getSourceWalletId(),
                quote.getTargetWalletId(),
                quote.getSourceCurrencyCode(),
                quote.getTargetCurrencyCode(),
                quote.getSourceAmount(),
                quote.getTargetAmount(),
                quote.getAppliedRate(),
                quote.getRateSide(),
                quote.getExpiresAt(),
                quote.getStatus().name(),
                fee.amount(),
                fee.currencyCode());
    }

    private FeeEstimate estimateFee(CalculatedQuote calculated) {
        return scaledInstantExFee(
                calculated.sourceWallet().getCurrencyCode(),
                calculated.targetWallet().getCurrencyCode(),
                calculated.sourceAmount(),
                calculated.appliedRate());
    }

    private FeeEstimate scaledInstantExFee(
            String sourceCode, String targetCode, BigDecimal sourceAmount, BigDecimal appliedRate) {
        BigDecimal raw =
                instantExFeeTierService.resolveFee(sourceCode, targetCode, sourceAmount, appliedRate);
        if (raw == null || raw.signum() <= 0) {
            return new FeeEstimate(null, null);
        }
        int precision = currencyService.getByCode(sourceCode).precision();
        BigDecimal scaled = raw.setScale(precision, RoundingMode.HALF_EVEN);
        return new FeeEstimate(scaled, sourceCode);
    }

    private record FeeEstimate(BigDecimal amount, String currencyCode) {
    }

    private record CalculatedQuote(
            Wallet sourceWallet,
            Wallet targetWallet,
            BigDecimal sourceAmount,
            BigDecimal targetAmount,
            BigDecimal appliedRate,
            String rateSide
    ) {
    }

    private record RateSelection(BigDecimal appliedRate, String rateSide) {
    }
}
