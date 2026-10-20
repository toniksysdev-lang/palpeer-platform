package com.palpeer.security.service;

import com.palpeer.common.audit.AuditRecord;
import com.palpeer.common.audit.AuditRecorder;
import com.palpeer.common.exception.BusinessException;
import com.palpeer.common.exception.ResourceNotFoundException;
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
 * Brute-force protection for PIN checks and security-answer checks. Counters are separate so a
 * wrong security answer does not burn a PIN attempt (admin Settings → PIN lockout still supplies
 * the shared max-attempts / lockout-hours policy for both).
 *
 * Failures are counted only after a wrong secret is confirmed — reservations no longer increment
 * the counter up front (that caused premature lockouts and stuck "locked" states without
 * {@code lockedUntil}).
 */
@Component
@RequiredArgsConstructor
public class PinAttemptGuard {

    public enum Kind {
        PIN,
        SECURITY_ANSWER
    }

    private final PinCredentialRepository pinCredentialRepository;
    private final PinPolicyService pinPolicyService;
    private final AuditRecorder auditRecorder;
    private final Clock clock;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void ensureNotLocked(UUID userId, Kind kind) {
        PinCredential credential = lock(userId);
        Instant lockedUntil = lockedUntil(credential, kind);
        Instant now = clock.instant();
        if (lockedUntil != null && lockedUntil.isAfter(now)) {
            throw locked();
        }
        if (lockedUntil != null) {
            clear(credential, kind);
            pinCredentialRepository.save(credential);
        }
    }

    /** Returns true when this failure locked the channel. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean recordFailure(UUID userId, Kind kind) {
        PinCredential credential = lock(userId);
        Instant now = clock.instant();
        Instant lockedUntil = lockedUntil(credential, kind);
        if (lockedUntil != null && lockedUntil.isAfter(now)) {
            return true;
        }
        if (lockedUntil != null) {
            clear(credential, kind);
        }

        int attempts = failedAttempts(credential, kind) + 1;
        setFailedAttempts(credential, kind, attempts);
        int max = pinPolicyService.maxAttempts();
        if (attempts < max) {
            pinCredentialRepository.save(credential);
            return false;
        }

        Instant until = now.plus(pinPolicyService.lockoutDuration());
        setLockedUntil(credential, kind, until);
        setFailedAttempts(credential, kind, 0);
        pinCredentialRepository.save(credential);
        auditRecorder.record(AuditRecord.builder(
                        kind == Kind.PIN ? "SECURITY_PIN_LOCKED" : "SECURITY_ANSWERS_LOCKED")
                .entity("PinCredential:" + credential.getId())
                .userRef(userId)
                .newValue("lockedUntil=" + until + ";kind=" + kind.name())
                .build());
        return true;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordSuccess(UUID userId, Kind kind) {
        PinCredential credential = lock(userId);
        if (failedAttempts(credential, kind) != 0 || lockedUntil(credential, kind) != null) {
            clear(credential, kind);
            pinCredentialRepository.save(credential);
        }
    }

    private PinCredential lock(UUID userId) {
        return pinCredentialRepository.findByUserIdForUpdate(userId)
                .orElseThrow(() -> new ResourceNotFoundException("PIN not set"));
    }

    private static int failedAttempts(PinCredential credential, Kind kind) {
        return kind == Kind.PIN
                ? credential.getFailedAttempts()
                : credential.getSecurityAnswerFailedAttempts();
    }

    private static Instant lockedUntil(PinCredential credential, Kind kind) {
        return kind == Kind.PIN
                ? credential.getLockedUntil()
                : credential.getSecurityAnswerLockedUntil();
    }

    private static void setFailedAttempts(PinCredential credential, Kind kind, int attempts) {
        if (kind == Kind.PIN) {
            credential.setFailedAttempts(attempts);
        } else {
            credential.setSecurityAnswerFailedAttempts(attempts);
        }
    }

    private static void setLockedUntil(PinCredential credential, Kind kind, Instant until) {
        if (kind == Kind.PIN) {
            credential.setLockedUntil(until);
        } else {
            credential.setSecurityAnswerLockedUntil(until);
        }
    }

    private static void clear(PinCredential credential, Kind kind) {
        setFailedAttempts(credential, kind, 0);
        setLockedUntil(credential, kind, null);
    }

    static BusinessException locked() {
        return new BusinessException(
                "PIN_LOCKED",
                "Too many incorrect attempts. Try again later.",
                HttpStatus.LOCKED);
    }
}
