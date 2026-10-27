package com.palpeer.auth.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.palpeer.auth.config.AuthProperties;
import com.palpeer.common.audit.AuditRecorder;
import com.palpeer.common.exception.BusinessException;
import com.palpeer.user.domain.User;
import com.palpeer.user.repository.UserRepository;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

@ExtendWith(MockitoExtension.class)
class LoginAttemptGuardTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private AuditRecorder auditRecorder;

    private AuthProperties authProperties;
    private Clock clock;
    private LoginAttemptGuard guard;

    @BeforeEach
    void setUp() {
        authProperties = new AuthProperties();
        authProperties.getLoginLockout().setMaxAttempts(3);
        authProperties.getLoginLockout().setLockoutDuration(Duration.ofMinutes(15));
        clock = Clock.fixed(Instant.parse("2026-01-15T12:00:00Z"), ZoneOffset.UTC);
        guard = new LoginAttemptGuard(userRepository, authProperties, auditRecorder, clock);
    }

    @Test
    void recordFailure_locksAfterMaxAttempts() {
        UUID id = UUID.randomUUID();
        User user = new User();
        user.setId(id);
        user.setFailedLoginAttempts(2);
        when(userRepository.findByIdForUpdate(id)).thenReturn(Optional.of(user));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        assertTrue(guard.recordFailure(id));

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(captor.capture());
        assertEquals(0, captor.getValue().getFailedLoginAttempts());
        assertEquals(Instant.parse("2026-01-15T12:15:00Z"), captor.getValue().getLoginLockedUntil());
    }

    @Test
    void ensureNotLocked_rejectsWhileLocked() {
        UUID id = UUID.randomUUID();
        User user = new User();
        user.setId(id);
        user.setLoginLockedUntil(Instant.parse("2026-01-15T12:30:00Z"));
        when(userRepository.findByIdForUpdate(id)).thenReturn(Optional.of(user));

        BusinessException ex = assertThrows(BusinessException.class, () -> guard.ensureNotLocked(id));
        assertEquals("ACCOUNT_LOCKED", ex.getCode());
        assertEquals(HttpStatus.LOCKED, ex.getStatus());
    }

    @Test
    void recordFailure_incrementsWithoutLockBeforeMax() {
        UUID id = UUID.randomUUID();
        User user = new User();
        user.setId(id);
        user.setFailedLoginAttempts(0);
        when(userRepository.findByIdForUpdate(id)).thenReturn(Optional.of(user));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        assertFalse(guard.recordFailure(id));
        assertEquals(1, user.getFailedLoginAttempts());
    }
}
