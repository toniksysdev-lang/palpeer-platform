package com.palpeer.security.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.palpeer.common.audit.AuditRecord;
import com.palpeer.common.audit.AuditRecorder;
import com.palpeer.common.exception.BusinessException;
import com.palpeer.security.domain.PinCredential;
import com.palpeer.security.repository.PinCredentialRepository;
import com.palpeer.security.service.PinAttemptGuard.Kind;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpStatus;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PinAttemptGuardTest {

    private static final Instant NOW = Instant.parse("2026-09-28T12:00:00Z");

    @Mock private PinCredentialRepository repository;
    @Mock private PinPolicyService pinPolicyService;
    @Mock private AuditRecorder auditRecorder;

    private PinAttemptGuard guard;
    private PinCredential credential;
    private UUID userId;

    @BeforeEach
    void setUp() {
        when(pinPolicyService.maxAttempts()).thenReturn(3);
        when(pinPolicyService.lockoutDuration()).thenReturn(Duration.ofMinutes(15));
        guard = new PinAttemptGuard(
                repository, pinPolicyService, auditRecorder, Clock.fixed(NOW, ZoneOffset.UTC));

        userId = UUID.randomUUID();
        credential = new PinCredential();
        credential.setId(UUID.randomUUID());
        credential.setUserId(userId);
        credential.setPinHash("hash");
        when(repository.findByUserIdForUpdate(userId)).thenReturn(Optional.of(credential));
    }

    @Test
    void locksPinAfterMaxConsecutiveFailures() {
        for (int i = 1; i <= 2; i++) {
            guard.ensureNotLocked(userId, Kind.PIN);
            assertThat(guard.recordFailure(userId, Kind.PIN)).isFalse();
            assertThat(credential.getFailedAttempts()).isEqualTo(i);
        }

        guard.ensureNotLocked(userId, Kind.PIN);
        assertThat(guard.recordFailure(userId, Kind.PIN)).isTrue();

        assertThat(credential.getLockedUntil()).isEqualTo(NOW.plus(Duration.ofMinutes(15)));
        verify(auditRecorder).record(any(AuditRecord.class));
        assertThatThrownBy(() -> guard.ensureNotLocked(userId, Kind.PIN))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> {
                    BusinessException be = (BusinessException) ex;
                    assertThat(be.getCode()).isEqualTo("PIN_LOCKED");
                    assertThat(be.getStatus()).isEqualTo(HttpStatus.LOCKED);
                });
    }

    @Test
    void securityAnswerFailuresDoNotBurnPinAttempts() {
        guard.ensureNotLocked(userId, Kind.SECURITY_ANSWER);
        assertThat(guard.recordFailure(userId, Kind.SECURITY_ANSWER)).isFalse();

        assertThat(credential.getSecurityAnswerFailedAttempts()).isEqualTo(1);
        assertThat(credential.getFailedAttempts()).isZero();

        guard.ensureNotLocked(userId, Kind.PIN);
        assertThat(credential.getFailedAttempts()).isZero();
        assertThat(credential.getLockedUntil()).isNull();
    }

    @Test
    void successResetsCounter() {
        guard.ensureNotLocked(userId, Kind.PIN);
        guard.recordFailure(userId, Kind.PIN);
        guard.ensureNotLocked(userId, Kind.PIN);

        guard.recordSuccess(userId, Kind.PIN);

        assertThat(credential.getFailedAttempts()).isZero();
        assertThat(credential.getLockedUntil()).isNull();
    }

    @Test
    void expiredLockAllowsANewWindow() {
        credential.setLockedUntil(NOW.minusSeconds(1));
        credential.setFailedAttempts(2);

        guard.ensureNotLocked(userId, Kind.PIN);

        assertThat(credential.getLockedUntil()).isNull();
        assertThat(credential.getFailedAttempts()).isZero();
    }
}
