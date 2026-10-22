package com.palpeer.auth.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

import com.palpeer.auth.domain.PhonePreVerification;
import com.palpeer.auth.repository.PhonePreVerificationRepository;
import com.palpeer.auth.repository.RefreshTokenRepository;
import com.palpeer.auth.web.dto.SignupStatusRequest;
import com.palpeer.auth.web.dto.SignupStatusResponse;
import com.palpeer.user.domain.User;
import com.palpeer.user.domain.UserStatus;
import com.palpeer.user.repository.UserRepository;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class AuthServiceSignupStatusTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private RefreshTokenRepository refreshTokenRepository;

    @Mock
    private PhonePreVerificationRepository phonePreVerificationRepository;

    @InjectMocks
    private AuthService authService;

    @Test
    void maskEmail_hidesLocalPart() {
        assertEquals("a***@example.com", AuthService.maskEmail("ada@example.com"));
        assertEquals("*@example.com", AuthService.maskEmail("a@example.com"));
        assertNull(AuthService.maskEmail(null));
        assertNull(AuthService.maskEmail("not-an-email"));
    }

    @Test
    void signupStatus_newPhone_requiresPhoneOtp() {
        when(userRepository.findByPhone("+15062100661")).thenReturn(Optional.empty());
        when(phonePreVerificationRepository.findByPhone("+15062100661")).thenReturn(Optional.empty());

        SignupStatusResponse status = authService.signupStatus(new SignupStatusRequest("+15062100661"));

        assertEquals(SignupStatusResponse.PHONE_OTP_REQUIRED, status.nextStep());
        assertFalse(status.hasLoggedIn());
    }

    @Test
    void signupStatus_freshPreVerify_requiresRegister() {
        PhonePreVerification row = new PhonePreVerification();
        row.setPhone("+15062100661");
        row.setExpiresAt(Instant.now().plusSeconds(600));
        when(userRepository.findByPhone("+15062100661")).thenReturn(Optional.empty());
        when(phonePreVerificationRepository.findByPhone("+15062100661")).thenReturn(Optional.of(row));

        SignupStatusResponse status = authService.signupStatus(new SignupStatusRequest("+15062100661"));

        assertEquals(SignupStatusResponse.REGISTER_REQUIRED, status.nextStep());
        assertTrue(status.phoneVerified());
    }

    @Test
    void signupStatus_unverifiedEmail_requiresEmailOtp() {
        User user = user("+15062100661", "ada@example.com", false, UserStatus.PENDING_VERIFICATION);
        when(userRepository.findByPhone("+15062100661")).thenReturn(Optional.of(user));
        when(refreshTokenRepository.existsByUserId(user.getId())).thenReturn(false);

        SignupStatusResponse status = authService.signupStatus(new SignupStatusRequest("+15062100661"));

        assertEquals(SignupStatusResponse.EMAIL_OTP_REQUIRED, status.nextStep());
        assertEquals("ada@example.com", status.email());
        assertEquals("a***@example.com", status.maskedEmail());
        assertFalse(status.hasLoggedIn());
    }

    @Test
    void signupStatus_verifiedNeverLoggedIn_isLoginReady() {
        User user = user("+15062100661", "ada@example.com", true, UserStatus.ACTIVE);
        when(userRepository.findByPhone("+15062100661")).thenReturn(Optional.of(user));
        when(refreshTokenRepository.existsByUserId(user.getId())).thenReturn(false);

        SignupStatusResponse status = authService.signupStatus(new SignupStatusRequest("+15062100661"));

        assertEquals(SignupStatusResponse.LOGIN_READY, status.nextStep());
        assertTrue(status.emailVerified());
        assertFalse(status.hasLoggedIn());
    }

    @Test
    void signupStatus_afterFirstLogin_stillLoginReadyWithHasLoggedIn() {
        User user = user("+15062100661", "ada@example.com", true, UserStatus.ACTIVE);
        when(userRepository.findByPhone("+15062100661")).thenReturn(Optional.of(user));
        when(refreshTokenRepository.existsByUserId(user.getId())).thenReturn(true);

        SignupStatusResponse status = authService.signupStatus(new SignupStatusRequest("+15062100661"));

        assertEquals(SignupStatusResponse.LOGIN_READY, status.nextStep());
        assertTrue(status.hasLoggedIn());
    }

    @Test
    void signupStatus_suspended_isBlocked() {
        User user = user("+15062100661", "ada@example.com", true, UserStatus.SUSPENDED);
        when(userRepository.findByPhone("+15062100661")).thenReturn(Optional.of(user));
        when(refreshTokenRepository.existsByUserId(user.getId())).thenReturn(true);

        SignupStatusResponse status = authService.signupStatus(new SignupStatusRequest("+15062100661"));

        assertEquals(SignupStatusResponse.BLOCKED, status.nextStep());
    }

    private static User user(String phone, String email, boolean emailVerified, UserStatus status) {
        User user = new User();
        user.setId(UUID.randomUUID());
        user.setPhone(phone);
        user.setEmail(email);
        user.setEmailVerified(emailVerified);
        user.setPhoneVerified(true);
        user.setEnabled(true);
        user.setStatus(status);
        return user;
    }
}
