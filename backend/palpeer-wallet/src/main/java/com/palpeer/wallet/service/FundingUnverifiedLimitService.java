package com.palpeer.wallet.service;

import com.palpeer.common.audit.AuditRecord;
import com.palpeer.common.audit.AuditRecorder;
import com.palpeer.common.exception.BusinessException;
import com.palpeer.currency.domain.Currency;
import com.palpeer.currency.repository.CurrencyRepository;
import com.palpeer.kyc.domain.KycStatus;
import com.palpeer.kyc.repository.KycCaseRepository;
import com.palpeer.wallet.domain.FundingUnverifiedLimit;
import com.palpeer.wallet.funding.FundingTransactionRepository;
import com.palpeer.wallet.funding.MoneyMovementStatus;
import com.palpeer.wallet.repository.FundingUnverifiedLimitRepository;
import com.palpeer.wallet.web.dto.FundingUnverifiedLimitResponse;
import com.palpeer.wallet.web.dto.UpsertFundingUnverifiedLimitRequest;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class FundingUnverifiedLimitService {

    private final FundingUnverifiedLimitRepository limitRepository;
    private final CurrencyRepository currencyRepository;
    private final FundingTransactionRepository fundingTransactionRepository;
    private final KycCaseRepository kycCaseRepository;
    private final AuditRecorder auditRecorder;

    @Transactional(readOnly = true)
    public List<FundingUnverifiedLimitResponse> listForWallets() {
        Map<String, FundingUnverifiedLimit> byCurrency = limitRepository.findAll().stream()
                .collect(Collectors.toMap(
                        l -> l.getCurrencyCode().toUpperCase(Locale.ROOT),
                        Function.identity(),
                        (a, b) -> a));

        List<FundingUnverifiedLimitResponse> rows = new ArrayList<>();
        for (Currency currency : currencyRepository.findAll()) {
            String code = currency.getCode() == null
                    ? ""
                    : currency.getCode().trim().toUpperCase(Locale.ROOT);
            if (code.isBlank()) {
                continue;
            }
            FundingUnverifiedLimit saved = byCurrency.get(code);
            if (saved != null) {
                rows.add(toResponse(saved));
            } else {
                rows.add(new FundingUnverifiedLimitResponse(null, code, null, null));
            }
        }
        rows.sort(Comparator.comparing(FundingUnverifiedLimitResponse::currencyCode));
        return rows;
    }

    @Transactional
    public FundingUnverifiedLimitResponse upsert(
            UUID actorUserId, UpsertFundingUnverifiedLimitRequest request) {
        String code = request.currencyCode().trim().toUpperCase(Locale.ROOT);
        currencyRepository
                .findByCodeIgnoreCase(code)
                .orElseThrow(() -> new BusinessException(
                        "CURRENCY_NOT_FOUND",
                        "Unknown wallet currency: " + code,
                        HttpStatus.BAD_REQUEST));

        FundingUnverifiedLimit entity = limitRepository
                .findByCurrencyCodeIgnoreCase(code)
                .orElseGet(FundingUnverifiedLimit::new);
        entity.setCurrencyCode(code);
        entity.setMaxAmount(request.maxAmount());
        limitRepository.save(entity);

        auditRecorder.record(AuditRecord.builder("FUNDING_UNVERIFIED_LIMIT_UPSERT")
                .entity("FundingUnverifiedLimit:" + entity.getId())
                .userRef(actorUserId)
                .newValue("currency=" + code + ";maxAmount=" + entity.getMaxAmount())
                .build());

        return toResponse(entity);
    }

    /**
     * Blocks funding that would push an unverified user's lifetime SUCCESS total above the
     * configured ceiling for that wallet currency. KYC {@code APPROVED} skips the check.
     * Currencies with no configured limit are unrestricted.
     */
    @Transactional(readOnly = true)
    public void assertWithinUnverifiedLimit(UUID userId, String currencyCode, BigDecimal amount) {
        if (amount == null || amount.signum() <= 0) {
            return;
        }
        String code = currencyCode == null ? "" : currencyCode.trim().toUpperCase(Locale.ROOT);
        var limit = limitRepository.findByCurrencyCodeIgnoreCase(code);
        if (limit.isEmpty()) {
            return;
        }
        if (isIdentityVerified(userId)) {
            return;
        }

        BigDecimal max = limit.get().getMaxAmount();
        BigDecimal already = fundingTransactionRepository.sumAmountByUserCurrencyAndStatus(
                userId, code, MoneyMovementStatus.SUCCESS);
        BigDecimal inFlight = fundingTransactionRepository.sumAmountByUserCurrencyAndStatus(
                userId, code, MoneyMovementStatus.PENDING);
        BigDecimal processing = fundingTransactionRepository.sumAmountByUserCurrencyAndStatus(
                userId, code, MoneyMovementStatus.PROCESSING);
        BigDecimal initiated = fundingTransactionRepository.sumAmountByUserCurrencyAndStatus(
                userId, code, MoneyMovementStatus.INITIATED);
        BigDecimal committed = nullToZero(already)
                .add(nullToZero(inFlight))
                .add(nullToZero(processing))
                .add(nullToZero(initiated));

        if (committed.add(amount).compareTo(max) > 0) {
            throw new BusinessException(
                    "IDENTITY_VERIFICATION_REQUIRED",
                    "Identity verification is required to fund this amount. Complete KYC and try again.",
                    HttpStatus.UNPROCESSABLE_ENTITY);
        }
    }

    private boolean isIdentityVerified(UUID userId) {
        return kycCaseRepository
                .findByUserId(userId)
                .map(c -> c.getStatus() == KycStatus.APPROVED)
                .orElse(false);
    }

    private static BigDecimal nullToZero(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private static FundingUnverifiedLimitResponse toResponse(FundingUnverifiedLimit entity) {
        return new FundingUnverifiedLimitResponse(
                entity.getId(), entity.getCurrencyCode(), entity.getMaxAmount(), entity.getUpdatedAt());
    }
}
