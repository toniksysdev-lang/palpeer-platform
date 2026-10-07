package com.palpeer.security.service;

import com.palpeer.common.audit.AuditRecord;
import com.palpeer.common.audit.AuditRecorder;
import com.palpeer.common.exception.BusinessException;
import com.palpeer.common.exception.ResourceNotFoundException;
import com.palpeer.security.config.PinSecurityProperties;
import com.palpeer.security.domain.PinCredential;
import com.palpeer.security.repository.PinCredentialRepository;
import java.time.Clock;
import java.time.Instant;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Brute-force protection for PIN checks. Every method runs in its own transaction so attempt
 * counters survive the caller's rollback when the PIN (or reset answer) is wrong.
 *
 * Callers must {@link #reserve} before comparing, then report {@link #recordFailure} or
 * {@link #recordSuccess}. Reserving counts the attempt up front, so parallel requests can never
 * exceed {@code maxAttempts} guesses per lockout window.
 */
@Component
@RequiredArgsConstructor
public class PinAttemptGuard {

    private final PinCredentialRepository pinCredentialRepository;
    private final PinSecurityProperties properties;
    private final AuditRecorder auditRecorder;
    private final Clock clock;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void reserve(UUID userId) {
        PinCredential credential = lock(userId);
        Instant now = clock.instant();
        if (credential.getLockedUntil() != null) {
            if (credential.getLockedUntil().isAfter(now)) {
                throw locked();
            }
            credential.setLockedUntil(null);
            credential.setFailedAttempts(0);
        }
        if (credential.getFailedAttempts() >= properties.getMaxAttempts()) {
            throw locked();
        }
        credential.setFailedAttempts(credential.getFailedAttempts() + 1);
        pinCredentialRepository.save(credential);
    }

    /** Returns true when this failure locked the PIN. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean recordFailure(UUID userId) {
        PinCredential credential = lock(userId);
        if (credential.getFailedAttempts() < properties.getMaxAttempts()) {
            return false;
        }
        credential.setLockedUntil(clock.instant().plus(properties.getLockoutDuration()));
        credential.setFailedAttempts(0);
        pinCredentialRepository.save(credential);
        auditRecorder.record(AuditRecord.builder("SECURITY_PIN_LOCKED")
                .entity("PinCredential:" + credential.getId())
                .userRef(userId)
                .newValue("lockedUntil=" + credential.getLockedUntil())
                .build());
        return true;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordSuccess(UUID userId) {
        PinCredential credential = lock(userId);
        if (credential.getFailedAttempts() != 0 || credential.getLockedUntil() != null) {
            credential.setFailedAttempts(0);
            credential.setLockedUntil(null);
            pinCredentialRepository.save(credential);
        }
    }

    private PinCredential lock(UUID userId) {
        return pinCredentialRepository.findByUserIdForUpdate(userId)
                .orElseThrow(() -> new ResourceNotFoundException("PIN not set"));
    }

    static BusinessException locked() {
        return new BusinessException(
                "PIN_LOCKED",
                "Too many incorrect attempts. Try again later.",
                HttpStatus.LOCKED);
    }
}
