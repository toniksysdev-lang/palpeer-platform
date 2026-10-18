package com.palpeer.wallet.service;

import com.palpeer.common.audit.AuditRecord;
import com.palpeer.common.audit.AuditRecorder;
import com.palpeer.common.exception.BusinessException;
import com.palpeer.currency.domain.Currency;
import com.palpeer.currency.repository.CurrencyRepository;
import com.palpeer.kyc.domain.KycStatus;
import com.palpeer.kyc.repository.KycCaseRepository;
import com.palpeer.wallet.domain.WithdrawalUnverifiedLimit;
import com.palpeer.wallet.funding.MoneyMovementStatus;
import com.palpeer.wallet.repository.WithdrawalUnverifiedLimitRepository;
import com.palpeer.wallet.web.dto.UpsertWithdrawalUnverifiedLimitRequest;
import com.palpeer.wallet.web.dto.WithdrawalUnverifiedLimitResponse;
import com.palpeer.wallet.withdrawal.WithdrawalTransactionRepository;
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
public class WithdrawalUnverifiedLimitService {

    private final WithdrawalUnverifiedLimitRepository limitRepository;
    private final CurrencyRepository currencyRepository;
    private final WithdrawalTransactionRepository withdrawalTransactionRepository;
    private final KycCaseRepository kycCaseRepository;
    private final AuditRecorder auditRecorder;

    @Transactional(readOnly = true)
    public List<WithdrawalUnverifiedLimitResponse> listForWallets() {
        Map<String, WithdrawalUnverifiedLimit> byCurrency = limitRepository.findAll().stream()
                .collect(Collectors.toMap(
                        l -> l.getCurrencyCode().toUpperCase(Locale.ROOT),
                        Function.identity(),
                        (a, b) -> a));

        List<WithdrawalUnverifiedLimitResponse> rows = new ArrayList<>();
        for (Currency currency : currencyRepository.findAll()) {
            String code = currency.getCode() == null
                    ? ""
                    : currency.getCode().trim().toUpperCase(Locale.ROOT);
            if (code.isBlank()) {
                continue;
            }
            WithdrawalUnverifiedLimit saved = byCurrency.get(code);
            if (saved != null) {
                rows.add(toResponse(saved));
            } else {
                rows.add(new WithdrawalUnverifiedLimitResponse(null, code, null, null));
            }
        }
        rows.sort(Comparator.comparing(WithdrawalUnverifiedLimitResponse::currencyCode));
        return rows;
    }

    @Transactional
    public WithdrawalUnverifiedLimitResponse upsert(
            UUID actorUserId, UpsertWithdrawalUnverifiedLimitRequest request) {
        String code = request.currencyCode().trim().toUpperCase(Locale.ROOT);
        currencyRepository
                .findByCodeIgnoreCase(code)
                .orElseThrow(() -> new BusinessException(
                        "CURRENCY_NOT_FOUND",
                        "Unknown wallet currency: " + code,
                        HttpStatus.BAD_REQUEST));

        WithdrawalUnverifiedLimit entity = limitRepository
                .findByCurrencyCodeIgnoreCase(code)
                .orElseGet(WithdrawalUnverifiedLimit::new);
        entity.setCurrencyCode(code);
        entity.setMaxAmount(request.maxAmount());
        limitRepository.save(entity);

        auditRecorder.record(AuditRecord.builder("WITHDRAWAL_UNVERIFIED_LIMIT_UPSERT")
                .entity("WithdrawalUnverifiedLimit:" + entity.getId())
                .userRef(actorUserId)
                .newValue("currency=" + code + ";maxAmount=" + entity.getMaxAmount())
                .build());

        return toResponse(entity);
    }

    /**
     * Blocks withdrawals that would push an unverified user's lifetime SUCCESS total above the
     * configured ceiling for that wallet currency. KYC {@code APPROVED} skips the check.
     * Currencies with no configured limit are unrestricted (legacy behaviour).
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
        BigDecimal already = withdrawalTransactionRepository.sumAmountByUserCurrencyAndStatus(
                userId, code, MoneyMovementStatus.SUCCESS);
        if (already == null) {
            already = BigDecimal.ZERO;
        }
        // Also count PENDING / PROCESSING / INITIATED holds so concurrent requests cannot bypass.
        BigDecimal inFlight = withdrawalTransactionRepository.sumAmountByUserCurrencyAndStatus(
                userId, code, MoneyMovementStatus.PENDING);
        BigDecimal processing = withdrawalTransactionRepository.sumAmountByUserCurrencyAndStatus(
                userId, code, MoneyMovementStatus.PROCESSING);
        BigDecimal initiated = withdrawalTransactionRepository.sumAmountByUserCurrencyAndStatus(
                userId, code, MoneyMovementStatus.INITIATED);
        BigDecimal committed = already
                .add(nullToZero(inFlight))
                .add(nullToZero(processing))
                .add(nullToZero(initiated));

        if (committed.add(amount).compareTo(max) > 0) {
            throw new BusinessException(
                    "IDENTITY_VERIFICATION_REQUIRED",
                    "Identity verification is required to withdraw this amount. Complete KYC and try again.",
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

    private static WithdrawalUnverifiedLimitResponse toResponse(WithdrawalUnverifiedLimit entity) {
        return new WithdrawalUnverifiedLimitResponse(
                entity.getId(), entity.getCurrencyCode(), entity.getMaxAmount(), entity.getUpdatedAt());
    }
}
