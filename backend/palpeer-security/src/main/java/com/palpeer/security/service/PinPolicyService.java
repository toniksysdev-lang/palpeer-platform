package com.palpeer.security.service;

import com.palpeer.common.audit.AuditRecord;
import com.palpeer.common.audit.AuditRecorder;
import com.palpeer.common.exception.BusinessException;
import com.palpeer.security.config.PinSecurityProperties;
import com.palpeer.security.domain.PinSecurityPolicy;
import com.palpeer.security.repository.PinSecurityPolicyRepository;
import com.palpeer.security.web.dto.PinPolicyResponse;
import com.palpeer.security.web.dto.UpdatePinPolicyRequest;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class PinPolicyService {

    private static final short SINGLETON_ID = 1;

    private final PinSecurityPolicyRepository repository;
    private final PinSecurityProperties defaults;
    private final AuditRecorder auditRecorder;

    @Transactional(readOnly = true)
    public int maxAttempts() {
        return repository
                .findById(SINGLETON_ID)
                .map(PinSecurityPolicy::getMaxWrongAttempts)
                .orElse(defaults.getMaxAttempts());
    }

    @Transactional(readOnly = true)
    public Duration lockoutDuration() {
        return repository
                .findById(SINGLETON_ID)
                .map(PinSecurityPolicy::getLockoutHours)
                .map(PinPolicyService::hoursToDuration)
                .orElse(defaults.getLockoutDuration());
    }

    @Transactional(readOnly = true)
    public PinPolicyResponse getPolicy() {
        return repository
                .findById(SINGLETON_ID)
                .map(this::toResponse)
                .orElseGet(() -> new PinPolicyResponse(
                        defaults.getMaxAttempts(),
                        durationToHours(defaults.getLockoutDuration()),
                        null));
    }

    @Transactional
    public PinPolicyResponse updatePolicy(UUID actorUserId, UpdatePinPolicyRequest request) {
        if (request.maxWrongAttempts() < 1 || request.maxWrongAttempts() > 50) {
            throw new BusinessException(
                    "PIN_POLICY_INVALID",
                    "No of PIN entries must be between 1 and 50",
                    HttpStatus.BAD_REQUEST);
        }
        if (request.lockoutHours() == null
                || request.lockoutHours().signum() <= 0
                || request.lockoutHours().compareTo(BigDecimal.valueOf(720)) > 0) {
            throw new BusinessException(
                    "PIN_POLICY_INVALID",
                    "Lockout hours must be greater than 0 and at most 720",
                    HttpStatus.BAD_REQUEST);
        }

        PinSecurityPolicy policy = repository.findById(SINGLETON_ID).orElseGet(PinSecurityPolicy::new);
        policy.setId(SINGLETON_ID);
        policy.setMaxWrongAttempts(request.maxWrongAttempts());
        policy.setLockoutHours(request.lockoutHours().setScale(2, RoundingMode.HALF_UP));
        repository.save(policy);

        auditRecorder.record(AuditRecord.builder("SECURITY_PIN_POLICY_UPDATE")
                .entity("PinSecurityPolicy:1")
                .userRef(actorUserId)
                .newValue("maxWrongAttempts="
                        + policy.getMaxWrongAttempts()
                        + ";lockoutHours="
                        + policy.getLockoutHours())
                .build());

        return toResponse(policy);
    }

    private PinPolicyResponse toResponse(PinSecurityPolicy policy) {
        return new PinPolicyResponse(
                policy.getMaxWrongAttempts(), policy.getLockoutHours(), policy.getUpdatedAt());
    }

    private static Duration hoursToDuration(BigDecimal hours) {
        long minutes = hours.multiply(BigDecimal.valueOf(60)).setScale(0, RoundingMode.HALF_UP).longValue();
        return Duration.ofMinutes(Math.max(1, minutes));
    }

    private static BigDecimal durationToHours(Duration duration) {
        return BigDecimal.valueOf(duration.toMinutes())
                .divide(BigDecimal.valueOf(60), 2, RoundingMode.HALF_UP);
    }
}
