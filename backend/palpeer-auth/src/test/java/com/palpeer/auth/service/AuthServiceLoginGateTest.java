package com.palpeer.auth.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.palpeer.auth.web.dto.LoginRequest;
import com.palpeer.common.exception.BusinessException;
import com.palpeer.user.domain.User;
import com.palpeer.user.domain.UserStatus;
import com.palpeer.user.repository.UserRepository;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;

@ExtendWith(MockitoExtension.class)
class AuthServiceLoginGateTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private LoginAttemptGuard loginAttemptGuard;

    @InjectMocks
    private AuthService authService;

    @Test
    void login_rejectsUnverifiedEmail() {
        User user = new User();
        user.setId(UUID.randomUUID());
        user.setEmail("ada@example.com");
        user.setPasswordHash("hash");
        user.setEnabled(true);
        user.setEmailVerified(false);
        user.setStatus(UserStatus.PENDING_VERIFICATION);

        when(userRepository.findByEmailIgnoreCase("ada@example.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(anyString(), anyString())).thenReturn(true);

        BusinessException ex = assertThrows(
                BusinessException.class,
                () -> authService.login(
                        new LoginRequest("ada@example.com", "secret", false, null, null, null)));

        assertEquals("EMAIL_NOT_VERIFIED", ex.getCode());
        assertEquals(HttpStatus.FORBIDDEN, ex.getStatus());
        verify(loginAttemptGuard, never()).recordSuccess(any());
    }

    @Test
    void login_recordsFailureOnBadPassword() {
        User user = new User();
        user.setId(UUID.randomUUID());
        user.setEmail("ada@example.com");
        user.setPasswordHash("hash");
        user.setEnabled(true);
        user.setEmailVerified(true);
        user.setStatus(UserStatus.ACTIVE);

        when(userRepository.findByEmailIgnoreCase("ada@example.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(anyString(), anyString())).thenReturn(false);

        BusinessException ex = assertThrows(
                BusinessException.class,
                () -> authService.login(
                        new LoginRequest("ada@example.com", "wrong", false, null, null, null)));

        assertEquals("INVALID_CREDENTIALS", ex.getCode());
        verify(loginAttemptGuard).recordFailure(user.getId());
    }
}
