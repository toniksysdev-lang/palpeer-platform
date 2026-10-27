package com.palpeer.auth.service;

import com.palpeer.auth.config.AuthProperties;
import com.palpeer.common.audit.AuditRecord;
import com.palpeer.common.audit.AuditRecorder;
import com.palpeer.common.exception.BusinessException;
import com.palpeer.user.domain.User;
import com.palpeer.user.repository.UserRepository;
import java.time.Clock;
import java.time.Instant;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Brute-force protection for password login. Failures are persisted in a new transaction so a
 * subsequent {@link BusinessException} from login does not roll back the attempt counter.
 */
@Component
@RequiredArgsConstructor
public class LoginAttemptGuard {

    private final UserRepository userRepository;
    private final AuthProperties authProperties;
    private final AuditRecorder auditRecorder;
    private final Clock clock;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void ensureNotLocked(UUID userId) {
        User user = lock(userId);
        Instant lockedUntil = user.getLoginLockedUntil();
        Instant now = clock.instant();
        if (lockedUntil != null && lockedUntil.isAfter(now)) {
            throw locked();
        }
        if (lockedUntil != null) {
            clear(user);
            userRepository.save(user);
        }
    }

    /** Returns true when this failure locked the account. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean recordFailure(UUID userId) {
        User user = lock(userId);
        Instant now = clock.instant();
        Instant lockedUntil = user.getLoginLockedUntil();
        if (lockedUntil != null && lockedUntil.isAfter(now)) {
            return true;
        }
        if (lockedUntil != null) {
            clear(user);
        }

        int attempts = user.getFailedLoginAttempts() + 1;
        user.setFailedLoginAttempts(attempts);
        int max = Math.max(1, authProperties.getLoginLockout().getMaxAttempts());
        if (attempts < max) {
            userRepository.save(user);
            return false;
        }

        Instant until = now.plus(authProperties.getLoginLockout().getLockoutDuration());
        user.setLoginLockedUntil(until);
        user.setFailedLoginAttempts(0);
        userRepository.save(user);
        auditRecorder.record(AuditRecord.builder("SECURITY_LOGIN_LOCKED")
                .entity("User:" + userId)
                .userRef(userId)
                .newValue("lockedUntil=" + until)
                .build());
        return true;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordSuccess(UUID userId) {
        User user = lock(userId);
        if (user.getFailedLoginAttempts() != 0 || user.getLoginLockedUntil() != null) {
            clear(user);
            userRepository.save(user);
        }
    }

    private User lock(UUID userId) {
        return userRepository
                .findByIdForUpdate(userId)
                .orElseThrow(() -> new BusinessException("USER_NOT_FOUND", "User not found", HttpStatus.NOT_FOUND));
    }

    private static void clear(User user) {
        user.setFailedLoginAttempts(0);
        user.setLoginLockedUntil(null);
    }

    static BusinessException locked() {
        return new BusinessException(
                "ACCOUNT_LOCKED",
                "Too many incorrect login attempts. Try again later.",
                HttpStatus.LOCKED);
    }
}
