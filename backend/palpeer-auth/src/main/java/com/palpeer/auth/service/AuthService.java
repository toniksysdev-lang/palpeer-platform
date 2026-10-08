package com.palpeer.auth.service;

import com.palpeer.auth.config.AuthProperties;
import com.palpeer.auth.domain.OtpChallenge;
import com.palpeer.auth.domain.OtpChannel;
import com.palpeer.auth.domain.OtpPurpose;
import com.palpeer.auth.domain.RefreshToken;
import com.palpeer.auth.otp.OtpSender;
import com.palpeer.auth.repository.OtpChallengeRepository;
import com.palpeer.auth.repository.RefreshTokenRepository;
import com.palpeer.auth.util.TokenHashing;
import com.palpeer.auth.web.dto.AuthTokensResponse;
import com.palpeer.auth.web.dto.ChangePasswordRequest;
import com.palpeer.auth.web.dto.LoginRequest;
import com.palpeer.auth.web.dto.OtpResendRequest;
import com.palpeer.auth.web.dto.OtpResendResponse;
import com.palpeer.auth.web.dto.OtpVerifyRequest;
import com.palpeer.auth.web.dto.PasswordResetConfirmRequest;
import com.palpeer.auth.web.dto.PasswordResetRequestDto;
import com.palpeer.auth.web.dto.RegisterRequest;
import com.palpeer.auth.web.dto.RegisterResponse;
import com.palpeer.auth.web.dto.SessionResponse;
import com.palpeer.common.audit.AuditRecord;
import com.palpeer.common.audit.AuditRecorder;
import com.palpeer.common.exception.BusinessException;
import com.palpeer.common.exception.ResourceNotFoundException;
import com.palpeer.common.mail.EmailSender;
import com.palpeer.common.mail.PalpeerEmailTemplates;
import com.palpeer.user.domain.User;
import com.palpeer.user.domain.UserStatus;
import com.palpeer.user.repository.UserRepository;
import io.jsonwebtoken.JwtException;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final OtpChallengeRepository otpChallengeRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuthProperties authProperties;
    private final OtpSender otpSender;
    private final EmailSender emailSender;
    private final AuditRecorder auditRecorder;
    private final GoogleIdTokenService googleIdTokenService;

    @Transactional
    public RegisterResponse register(RegisterRequest request) {
        if (userRepository.existsByEmailIgnoreCase(request.email())) {
            throw new BusinessException("EMAIL_ALREADY_REGISTERED", "Email already registered", HttpStatus.CONFLICT);
        }
        if (userRepository.existsByPhone(request.phone())) {
            throw new BusinessException("PHONE_ALREADY_REGISTERED", "Phone already registered", HttpStatus.CONFLICT);
        }

        User user = new User();
        user.setEmail(request.email().trim().toLowerCase());
        user.setPhone(request.phone().trim());
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        // CONTRACT_PENDING: initial status / enabled semantics
        user.setStatus(UserStatus.PENDING_VERIFICATION);
        user.setEnabled(true);
        user.setEmailVerified(false);
        user.setPhoneVerified(false);
        userRepository.save(user);

        String emailOtp = issueOtp(user, OtpPurpose.EMAIL_VERIFICATION, OtpChannel.EMAIL);
        issueOtp(user, OtpPurpose.PHONE_VERIFICATION, OtpChannel.SMS);
        sendWelcomeEmail(user);

        // Always return debugOtp while outbound SMTP is unreliable on free hosts (Render).
        // Clients autofill verification; re-gate on log-code once real email delivery works.
        return new RegisterResponse(
                user.getId(),
                user.getEmail(),
                user.getPhone(),
                user.getStatus().name(),
                "Registration successful. OTP verification required.",
                emailOtp
        );
    }

    @Transactional
    public AuthTokensResponse login(LoginRequest request) {
        User user = findByEmailOrPhone(request.email().trim())
                .orElseThrow(() -> new BusinessException("INVALID_CREDENTIALS", "Invalid credentials", HttpStatus.UNAUTHORIZED));

        if (!user.isEnabled()) {
            throw new BusinessException("USER_DISABLED", "User account is disabled", HttpStatus.FORBIDDEN);
        }
        if (user.getPasswordHash() == null || user.getPasswordHash().isBlank()) {
            throw new BusinessException(
                    "PASSWORD_LOGIN_UNAVAILABLE",
                    "This account uses Google Sign-In. Continue with Google.",
                    HttpStatus.BAD_REQUEST);
        }
        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new BusinessException("INVALID_CREDENTIALS", "Invalid credentials", HttpStatus.UNAUTHORIZED);
        }

        // CONTRACT_PENDING: whether unverified users may obtain tokens
        boolean remember = Boolean.TRUE.equals(request.rememberMe());
        return issueTokenPair(user, remember);
    }

    /**
     * Sign in or sign up with a Google ID token. Existing email accounts are linked to Google;
     * new accounts are created with a verified email and no password/phone.
     */
    @Transactional
    public AuthTokensResponse loginWithGoogle(String idToken) {
        GoogleIdTokenService.GoogleIdentity identity = googleIdTokenService.verify(idToken);

        User user = userRepository.findByGoogleSub(identity.subject()).orElse(null);
        if (user == null) {
            user = userRepository.findByEmailIgnoreCase(identity.email()).orElse(null);
            if (user != null) {
                if (user.getGoogleSub() != null && !user.getGoogleSub().equals(identity.subject())) {
                    throw new BusinessException(
                            "GOOGLE_ACCOUNT_CONFLICT",
                            "This email is linked to a different Google account",
                            HttpStatus.CONFLICT);
                }
                user.setGoogleSub(identity.subject());
                user.setEmailVerified(true);
                if (user.getStatus() == UserStatus.PENDING_VERIFICATION && user.isPhoneVerified()) {
                    user.setStatus(UserStatus.ACTIVE);
                } else if (user.getStatus() == UserStatus.PENDING_VERIFICATION && user.getPhone() == null) {
                    user.setStatus(UserStatus.ACTIVE);
                }
                userRepository.save(user);
            } else {
                user = new User();
                user.setEmail(identity.email());
                user.setPhone(null);
                user.setPasswordHash(null);
                user.setGoogleSub(identity.subject());
                user.setStatus(UserStatus.ACTIVE);
                user.setEnabled(true);
                user.setEmailVerified(true);
                user.setPhoneVerified(false);
                userRepository.save(user);
                sendWelcomeEmail(user);
            }
        }

        if (!user.isEnabled()) {
            throw new BusinessException("USER_DISABLED", "User account is disabled", HttpStatus.FORBIDDEN);
        }

        auditRecorder.record(AuditRecord.builder("SECURITY_GOOGLE_LOGIN")
                .entity("User:" + user.getId())
                .userRef(user.getId())
                .newValue("googleSub=" + identity.subject())
                .build());

        return issueTokenPair(user);
    }

    private Optional<User> findByEmailOrPhone(String identifier) {
        if (identifier.contains("@")) {
            return userRepository.findByEmailIgnoreCase(identifier);
        }
        return userRepository.findByPhone(identifier);
    }

    @Transactional
    public void logout(String refreshTokenRaw) {
        String hash = TokenHashing.sha256(refreshTokenRaw);
        refreshTokenRepository.findByTokenHashAndRevokedFalse(hash).ifPresent(token -> {
            token.setRevoked(true);
            token.setRevokedAt(Instant.now());
            refreshTokenRepository.save(token);
        });
    }

    @Transactional
    public AuthTokensResponse refresh(String refreshTokenRaw) {
        ClaimsUser claimsUser = validateRefreshJwt(refreshTokenRaw);
        String hash = TokenHashing.sha256(refreshTokenRaw);
        RefreshToken stored = refreshTokenRepository.findByTokenHashAndRevokedFalse(hash)
                .orElseThrow(() -> new BusinessException("INVALID_REFRESH_TOKEN", "Refresh token is invalid or revoked", HttpStatus.UNAUTHORIZED));

        if (stored.getExpiresAt().isBefore(Instant.now())) {
            throw new BusinessException("REFRESH_TOKEN_EXPIRED", "Refresh token expired", HttpStatus.UNAUTHORIZED);
        }

        User user = userRepository.findById(claimsUser.userId())
                .orElseThrow(() -> new BusinessException("USER_NOT_FOUND", "User not found", HttpStatus.UNAUTHORIZED));
        if (!user.isEnabled()) {
            throw new BusinessException("USER_DISABLED", "User account is disabled", HttpStatus.FORBIDDEN);
        }

        stored.setRevoked(true);
        stored.setRevokedAt(Instant.now());

        AuthTokensResponse pair = issueTokenPair(user);
        stored.setReplacedByHash(TokenHashing.sha256(pair.refreshToken()));
        refreshTokenRepository.save(stored);
        return pair;
    }

    @Transactional
    public void verifyOtp(OtpVerifyRequest request) {
        if (request.purpose() == OtpPurpose.PASSWORD_RESET) {
            throw new BusinessException(
                    "OTP_PURPOSE_INVALID",
                    "Password-reset OTP must be confirmed via password-reset/confirm",
                    HttpStatus.BAD_REQUEST);
        }

        User user = requireUserByEmail(request.email());
        OtpChallenge challenge = otpChallengeRepository
                .findFirstByUserIdAndPurposeAndConsumedFalseOrderByCreatedAtDesc(user.getId(), request.purpose())
                .orElseThrow(() -> new BusinessException("OTP_NOT_FOUND", "No active OTP challenge", HttpStatus.BAD_REQUEST));

        assertChallengeUsable(challenge, request.channel());
        if (!TokenHashing.sha256(request.code()).equals(challenge.getCodeHash())) {
            challenge.setAttemptCount(challenge.getAttemptCount() + 1);
            otpChallengeRepository.save(challenge);
            throw new BusinessException("OTP_INVALID", "Invalid OTP code", HttpStatus.BAD_REQUEST);
        }

        challenge.setConsumed(true);
        challenge.setConsumedAt(Instant.now());
        otpChallengeRepository.save(challenge);

        applyVerificationFlags(user, request.purpose());
        userRepository.save(user);
        auditRecorder.record(AuditRecord.builder("SECURITY_OTP_VERIFY")
                .entity("User:" + user.getId())
                .userRef(user.getId())
                .newValue("purpose=" + request.purpose()
                        + ";emailVerified=" + user.isEmailVerified()
                        + ";phoneVerified=" + user.isPhoneVerified()
                        + ";status=" + user.getStatus())
                .build());
    }

    @Transactional
    public OtpResendResponse resendOtp(OtpResendRequest request) {
        if (request.purpose() == OtpPurpose.PASSWORD_RESET) {
            // Align with password-reset/request: no account enumeration
            userRepository.findByEmailIgnoreCase(request.email().trim()).ifPresent(user ->
                    issueOtp(user, OtpPurpose.PASSWORD_RESET, request.channel()));
            return new OtpResendResponse(null);
        }

        User user = requireUserByEmail(request.email());
        String code = issueOtp(user, request.purpose(), request.channel());
        return new OtpResendResponse(code);
    }

    @Transactional
    public void requestPasswordReset(PasswordResetRequestDto request) {
        // Avoid account enumeration: always succeed from API perspective when user missing
        userRepository.findByEmailIgnoreCase(request.email().trim()).ifPresent(user ->
                issueOtp(user, OtpPurpose.PASSWORD_RESET, OtpChannel.EMAIL));
    }

    @Transactional
    public void confirmPasswordReset(PasswordResetConfirmRequest request) {
        User user = requireUserByEmail(request.email());
        OtpChallenge challenge = otpChallengeRepository
                .findFirstByUserIdAndPurposeAndConsumedFalseOrderByCreatedAtDesc(
                        user.getId(), OtpPurpose.PASSWORD_RESET)
                .orElseThrow(() -> new BusinessException("OTP_NOT_FOUND", "No active password-reset OTP", HttpStatus.BAD_REQUEST));

        assertChallengeUsable(challenge, OtpChannel.EMAIL);
        if (!TokenHashing.sha256(request.code()).equals(challenge.getCodeHash())) {
            challenge.setAttemptCount(challenge.getAttemptCount() + 1);
            otpChallengeRepository.save(challenge);
            throw new BusinessException("OTP_INVALID", "Invalid OTP code", HttpStatus.BAD_REQUEST);
        }

        challenge.setConsumed(true);
        challenge.setConsumedAt(Instant.now());
        otpChallengeRepository.save(challenge);

        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        userRepository.save(user);

        revokeAllRefreshTokens(user.getId());
        auditRecorder.record(AuditRecord.builder("SECURITY_PASSWORD_RESET")
                .entity("User:" + user.getId())
                .userRef(user.getId())
                .newValue("passwordReset=true;refreshTokensRevoked=true")
                .build());
    }

    /** Own-account password change; revokes every refresh token for the user. */
    @Transactional
    public void changePassword(UUID userId, ChangePasswordRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException("USER_NOT_FOUND", "User not found", HttpStatus.NOT_FOUND));
        if (user.getPasswordHash() == null || user.getPasswordHash().isBlank()) {
            throw new BusinessException(
                    "PASSWORD_LOGIN_UNAVAILABLE",
                    "This account uses Google Sign-In. Set a password after linking email login, or continue with Google.",
                    HttpStatus.BAD_REQUEST);
        }
        if (!passwordEncoder.matches(request.currentPassword(), user.getPasswordHash())) {
            throw new BusinessException(
                    "INVALID_CURRENT_PASSWORD", "Current password is incorrect", HttpStatus.BAD_REQUEST);
        }
        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        userRepository.save(user);

        revokeAllRefreshTokens(user.getId());
        auditRecorder.record(AuditRecord.builder("SECURITY_PASSWORD_CHANGE")
                .entity("User:" + user.getId())
                .userRef(user.getId())
                .newValue("passwordChanged=true;refreshTokensRevoked=true")
                .build());
    }

    /**
     * Non-revoked, non-expired refresh tokens for the user. {@code current} is true when the
     * token hash matches the optional raw refresh token supplied by the caller.
     */
    @Transactional(readOnly = true)
    public List<SessionResponse> listSessions(UUID userId, String currentRefreshTokenRaw) {
        String currentHash = currentRefreshTokenRaw == null || currentRefreshTokenRaw.isBlank()
                ? null
                : TokenHashing.sha256(currentRefreshTokenRaw.trim());
        return refreshTokenRepository
                .findByUserIdAndRevokedFalseAndExpiresAtAfterOrderByCreatedAtDesc(userId, Instant.now())
                .stream()
                .map(t -> new SessionResponse(
                        t.getId(),
                        t.getCreatedAt(),
                        t.getExpiresAt(),
                        currentHash != null && currentHash.equals(t.getTokenHash())))
                .toList();
    }

    @Transactional
    public void revokeSession(UUID userId, UUID sessionId) {
        RefreshToken token = refreshTokenRepository.findByIdAndUserId(sessionId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Session not found"));
        if (!token.isRevoked()) {
            token.setRevoked(true);
            token.setRevokedAt(Instant.now());
            refreshTokenRepository.save(token);
        }
    }

    @Transactional
    public void revokeAllSessions(UUID userId) {
        revokeAllRefreshTokens(userId);
    }

    private void revokeAllRefreshTokens(UUID userId) {
        List<RefreshToken> active = refreshTokenRepository.findByUserIdAndRevokedFalse(userId);
        Instant now = Instant.now();
        for (RefreshToken token : active) {
            token.setRevoked(true);
            token.setRevokedAt(now);
        }
        refreshTokenRepository.saveAll(active);
    }

    private AuthTokensResponse issueTokenPair(User user) {
        return issueTokenPair(user, false);
    }

    private AuthTokensResponse issueTokenPair(User user, boolean rememberMe) {
        String access = jwtService.createAccessToken(user.getId(), user.getEmail());
        var refreshTtl = rememberMe
                ? authProperties.getJwt().getRefreshTokenTtlRemembered()
                : authProperties.getJwt().getRefreshTokenTtl();
        String refresh = jwtService.createRefreshToken(user.getId(), refreshTtl);

        RefreshToken entity = new RefreshToken();
        entity.setUserId(user.getId());
        entity.setTokenHash(TokenHashing.sha256(refresh));
        entity.setExpiresAt(jwtService.extractExpiry(refresh));
        entity.setRevoked(false);
        refreshTokenRepository.save(entity);

        return AuthTokensResponse.of(user.getId(), access, refresh);
    }

    private String issueOtp(User user, OtpPurpose purpose, OtpChannel channel) {
        String destination = channel == OtpChannel.EMAIL ? user.getEmail() : user.getPhone();
        String code = TokenHashing.numericCode(authProperties.getOtp().getLength());

        OtpChallenge challenge = new OtpChallenge();
        challenge.setUserId(user.getId());
        challenge.setPurpose(purpose);
        challenge.setChannel(channel);
        challenge.setDestination(destination);
        challenge.setCodeHash(TokenHashing.sha256(code));
        challenge.setExpiresAt(Instant.now().plus(authProperties.getOtp().getTtl()));
        challenge.setConsumed(false);
        challenge.setAttemptCount(0);
        otpChallengeRepository.save(challenge);

        otpSender.send(channel, destination, purpose, code);
        return code;
    }

    private void assertChallengeUsable(OtpChallenge challenge, OtpChannel expectedChannel) {
        if (challenge.getChannel() != expectedChannel) {
            throw new BusinessException("OTP_CHANNEL_MISMATCH", "OTP channel mismatch", HttpStatus.BAD_REQUEST);
        }
        if (challenge.getExpiresAt().isBefore(Instant.now())) {
            throw new BusinessException("OTP_EXPIRED", "OTP expired", HttpStatus.BAD_REQUEST);
        }
        if (challenge.getAttemptCount() >= authProperties.getOtp().getMaxAttempts()) {
            throw new BusinessException("OTP_MAX_ATTEMPTS", "OTP max attempts exceeded", HttpStatus.BAD_REQUEST);
        }
    }

    private void applyVerificationFlags(User user, OtpPurpose purpose) {
        switch (purpose) {
            case EMAIL_VERIFICATION -> user.setEmailVerified(true);
            case PHONE_VERIFICATION -> user.setPhoneVerified(true);
            case PASSWORD_RESET -> {
                // no verification flag change
            }
        }
        // CONTRACT_PENDING: when status becomes ACTIVE
        if (user.isEmailVerified() && user.isPhoneVerified()
                && user.getStatus() == UserStatus.PENDING_VERIFICATION) {
            user.setStatus(UserStatus.ACTIVE);
        }
    }

    private void sendWelcomeEmail(User user) {
        try {
            var rendered = PalpeerEmailTemplates.welcome(user.getEmail());
            emailSender.send(user.getEmail(), rendered.subject(), rendered.text(), rendered.html());
            log.info("Welcome email sent [userId={}, email={}]", user.getId(), user.getEmail());
        } catch (RuntimeException ex) {
            log.warn(
                    "Welcome email failed [userId={}, email={}]: {}",
                    user.getId(),
                    user.getEmail(),
                    ex.getMessage());
        }
    }

    private User requireUserByEmail(String email) {
        return userRepository.findByEmailIgnoreCase(email.trim())
                .orElseThrow(() -> new BusinessException("USER_NOT_FOUND", "User not found", HttpStatus.NOT_FOUND));
    }

    private ClaimsUser validateRefreshJwt(String refreshTokenRaw) {
        try {
            if (!jwtService.isRefreshToken(refreshTokenRaw)) {
                throw new BusinessException("INVALID_REFRESH_TOKEN", "Token is not a refresh token", HttpStatus.UNAUTHORIZED);
            }
            return new ClaimsUser(jwtService.extractUserId(refreshTokenRaw));
        } catch (JwtException | IllegalArgumentException ex) {
            throw new BusinessException("INVALID_REFRESH_TOKEN", "Refresh token is invalid", HttpStatus.UNAUTHORIZED);
        }
    }

    private record ClaimsUser(UUID userId) {
    }
}
