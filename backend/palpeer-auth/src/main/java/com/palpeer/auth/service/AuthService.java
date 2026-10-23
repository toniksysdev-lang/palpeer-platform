package com.palpeer.auth.service;

import com.palpeer.auth.config.AuthProperties;
import com.palpeer.auth.domain.AccountSuspendToken;
import com.palpeer.auth.domain.OtpChallenge;
import com.palpeer.auth.domain.OtpChannel;
import com.palpeer.auth.domain.OtpPurpose;
import com.palpeer.auth.domain.PhonePreVerification;
import com.palpeer.auth.domain.RefreshToken;
import com.palpeer.auth.otp.OtpSender;
import com.palpeer.auth.repository.AccountSuspendTokenRepository;
import com.palpeer.auth.repository.OtpChallengeRepository;
import com.palpeer.auth.repository.PhonePreVerificationRepository;
import com.palpeer.auth.repository.RefreshTokenRepository;
import com.palpeer.auth.spi.TransactionPinMatcher;
import com.palpeer.auth.util.TokenHashing;
import com.palpeer.auth.web.dto.AuthTokensResponse;
import com.palpeer.auth.web.dto.ChangePasswordRequest;
import com.palpeer.auth.web.dto.DeviceLoginInfo;
import com.palpeer.auth.web.dto.LoginRequest;
import com.palpeer.auth.web.dto.OtpResendRequest;
import com.palpeer.auth.web.dto.OtpResendResponse;
import com.palpeer.auth.web.dto.OtpVerifyRequest;
import com.palpeer.auth.web.dto.PasswordResetConfirmRequest;
import com.palpeer.auth.web.dto.PasswordResetRequestDto;
import com.palpeer.auth.web.dto.PhoneOtpRequest;
import com.palpeer.auth.web.dto.PhoneOtpVerifyRequest;
import com.palpeer.auth.web.dto.RegisterRequest;
import com.palpeer.auth.web.dto.RegisterResponse;
import com.palpeer.auth.web.dto.SessionResponse;
import com.palpeer.auth.web.dto.SignupStatusRequest;
import com.palpeer.auth.web.dto.SignupStatusResponse;
import com.palpeer.auth.web.dto.SuspendAccountRequest;
import com.palpeer.common.audit.AuditRecord;
import com.palpeer.common.audit.AuditRecorder;
import com.palpeer.common.exception.BusinessException;
import com.palpeer.common.exception.ResourceNotFoundException;
import com.palpeer.common.mail.EmailBrand;
import com.palpeer.common.mail.EmailSender;
import com.palpeer.common.mail.PalpeerEmailTemplates;
import com.palpeer.user.domain.User;
import com.palpeer.user.domain.UserStatus;
import com.palpeer.user.repository.UserRepository;
import io.jsonwebtoken.JwtException;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.util.HtmlUtils;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private static final DateTimeFormatter ALERT_WHEN =
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm 'UTC'").withZone(ZoneOffset.UTC);

    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final OtpChallengeRepository otpChallengeRepository;
    private final PhonePreVerificationRepository phonePreVerificationRepository;
    private final AccountSuspendTokenRepository accountSuspendTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuthProperties authProperties;
    private final OtpSender otpSender;
    private final EmailSender emailSender;
    private final AuditRecorder auditRecorder;
    private final GoogleIdTokenService googleIdTokenService;
    private final ObjectProvider<TransactionPinMatcher> pinMatcher;

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
        boolean phoneAlreadyVerified = consumeFreshPhonePreVerification(user.getPhone());
        user.setPhoneVerified(phoneAlreadyVerified);
        userRepository.save(user);

        String emailOtp = issueOtp(user, OtpPurpose.EMAIL_VERIFICATION, OtpChannel.EMAIL);
        if (!phoneAlreadyVerified) {
            issueOtp(user, OtpPurpose.PHONE_VERIFICATION, OtpChannel.SMS);
        }
        // Welcome email is sent after EMAIL_VERIFICATION succeeds (see verifyOtp).

        // Only expose the code when log-code is on (dev logs / troubleshooting). Clients never autofill.
        return new RegisterResponse(
                user.getId(),
                user.getEmail(),
                user.getPhone(),
                user.getStatus().name(),
                "Registration successful. OTP verification required.",
                authProperties.getOtp().isLogCode() ? emailOtp : null
        );
    }

    /**
     * Resolves where phone-based signup should continue so the client can resume incomplete
     * registration (email OTP, create-account, or login) instead of hard-stopping.
     */
    @Transactional(readOnly = true)
    public SignupStatusResponse signupStatus(SignupStatusRequest request) {
        String phone = normalizePhone(request.phone());
        Optional<User> existing = userRepository.findByPhone(phone);
        if (existing.isPresent()) {
            return statusForUser(phone, existing.get());
        }
        if (hasFreshPhonePreVerification(phone)) {
            return new SignupStatusResponse(
                    SignupStatusResponse.REGISTER_REQUIRED,
                    phone,
                    null,
                    null,
                    false,
                    true,
                    false,
                    null);
        }
        return new SignupStatusResponse(
                SignupStatusResponse.PHONE_OTP_REQUIRED,
                phone,
                null,
                null,
                false,
                false,
                false,
                null);
    }

    /**
     * Sends a pre-registration SMS OTP for the given phone (no user account yet).
     * When an incomplete account already exists for the phone, returns conflict with
     * {@code SIGNUP_INCOMPLETE} so the client can call {@link #signupStatus} and resume.
     */
    @Transactional
    public OtpResendResponse requestPhoneOtp(PhoneOtpRequest request) {
        String phone = normalizePhone(request.phone());
        Optional<User> existing = userRepository.findByPhone(phone);
        if (existing.isPresent()) {
            SignupStatusResponse status = statusForUser(phone, existing.get());
            if (SignupStatusResponse.EMAIL_OTP_REQUIRED.equals(status.nextStep())
                    || (SignupStatusResponse.LOGIN_READY.equals(status.nextStep())
                            && !status.hasLoggedIn())) {
                throw new BusinessException(
                        "SIGNUP_INCOMPLETE",
                        "Registration is incomplete for this phone. Continue where you left off.",
                        HttpStatus.CONFLICT);
            }
            if (SignupStatusResponse.BLOCKED.equals(status.nextStep())) {
                throw new BusinessException(
                        "USER_DISABLED", "This account has been disabled", HttpStatus.FORBIDDEN);
            }
            throw new BusinessException(
                    "PHONE_ALREADY_REGISTERED", "Phone already registered", HttpStatus.CONFLICT);
        }
        String code = issuePhonePreRegisterOtp(phone);
        return new OtpResendResponse(authProperties.getOtp().isLogCode() ? code : null);
    }

    /**
     * Resends the email verification OTP for an incomplete signup identified by phone.
     */
    @Transactional
    public OtpResendResponse resendSignupEmailOtp(SignupStatusRequest request) {
        String phone = normalizePhone(request.phone());
        User user = userRepository
                .findByPhone(phone)
                .orElseThrow(() -> new BusinessException(
                        "USER_NOT_FOUND", "No account found for this phone", HttpStatus.NOT_FOUND));
        if (!user.isEnabled()
                || user.getStatus() == UserStatus.SUSPENDED
                || user.getStatus() == UserStatus.CLOSED) {
            throw new BusinessException(
                    "USER_DISABLED", "This account has been disabled", HttpStatus.FORBIDDEN);
        }
        if (user.isEmailVerified()) {
            throw new BusinessException(
                    "EMAIL_ALREADY_VERIFIED",
                    "Email is already verified. Sign in to continue.",
                    HttpStatus.CONFLICT);
        }
        String code = issueOtp(user, OtpPurpose.EMAIL_VERIFICATION, OtpChannel.EMAIL);
        return new OtpResendResponse(authProperties.getOtp().isLogCode() ? code : null);
    }

    /**
     * Verifies a pre-registration SMS OTP and records a short-lived phone verification window used
     * at {@link #register(RegisterRequest)}.
     */
    @Transactional
    public void verifyPhoneOtp(PhoneOtpVerifyRequest request) {
        String phone = normalizePhone(request.phone());
        OtpChallenge challenge = otpChallengeRepository
                .findFirstByDestinationAndPurposeAndChannelAndConsumedFalseAndUserIdIsNullOrderByCreatedAtDesc(
                        phone, OtpPurpose.PHONE_VERIFICATION, OtpChannel.SMS)
                .orElseThrow(() -> new BusinessException(
                        "OTP_NOT_FOUND", "OTP not found", HttpStatus.BAD_REQUEST));

        assertChallengeUsable(challenge, OtpChannel.SMS);
        challenge.setAttemptCount(challenge.getAttemptCount() + 1);
        if (!TokenHashing.sha256(request.code().trim()).equals(challenge.getCodeHash())) {
            otpChallengeRepository.save(challenge);
            throw new BusinessException("OTP_INVALID", "Invalid OTP", HttpStatus.BAD_REQUEST);
        }
        challenge.setConsumed(true);
        challenge.setConsumedAt(Instant.now());
        otpChallengeRepository.save(challenge);

        PhonePreVerification row = phonePreVerificationRepository
                .findByPhone(phone)
                .orElseGet(PhonePreVerification::new);
        row.setPhone(phone);
        row.setVerifiedAt(Instant.now());
        row.setExpiresAt(Instant.now().plus(authProperties.getOtp().getTtl().multipliedBy(3)));
        phonePreVerificationRepository.save(row);
    }

    @Transactional
    public AuthTokensResponse login(LoginRequest request) {
        User user = findByEmailOrPhone(request.email().trim())
                .orElseThrow(() -> new BusinessException("INVALID_CREDENTIALS", "Invalid credentials", HttpStatus.UNAUTHORIZED));

        if (!user.isEnabled()) {
            throw new BusinessException("USER_DISABLED", "User account is disabled", HttpStatus.FORBIDDEN);
        }
        if (user.getPasswordHash() == null || user.getPasswordHash().isBlank()) {
            if (user.getGoogleSub() != null && !user.getGoogleSub().isBlank()) {
                throw new BusinessException(
                        "PASSWORD_LOGIN_UNAVAILABLE",
                        "This account uses Google Sign-In. Continue with Google.",
                        HttpStatus.BAD_REQUEST);
            }
            // Blank hash with no Google link — usually a data issue; send user to reset.
            throw new BusinessException(
                    "PASSWORD_NOT_SET",
                    "No password is set for this account. Use Forgot password to create one.",
                    HttpStatus.BAD_REQUEST);
        }
        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new BusinessException("INVALID_CREDENTIALS", "Invalid credentials", HttpStatus.UNAUTHORIZED);
        }
        if (!user.isEmailVerified()) {
            throw new BusinessException(
                    "EMAIL_NOT_VERIFIED",
                    "Verify your email before signing in.",
                    HttpStatus.FORBIDDEN);
        }

        boolean remember = Boolean.TRUE.equals(request.rememberMe());
        return completeLogin(user, remember, request.device());
    }

    /**
     * Sign in or sign up with a Google ID token. Existing email accounts are linked to Google;
     * new accounts are created with a verified email and no password/phone.
     */
    @Transactional
    public AuthTokensResponse loginWithGoogle(String idToken, DeviceLoginInfo device) {
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

        return completeLogin(user, false, device);
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

        DeviceLoginInfo device = DeviceLoginInfo.of(
                stored.getDeviceIdentifier(), stored.getDeviceName(), stored.getPlatform());
        AuthTokensResponse pair = issueTokenPair(user, false, device);
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

        boolean firstEmailVerification =
                request.purpose() == OtpPurpose.EMAIL_VERIFICATION && !user.isEmailVerified();

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

        if (firstEmailVerification) {
            sendWelcomeEmail(user);
        }
    }

    @Transactional
    public OtpResendResponse resendOtp(OtpResendRequest request) {
        if (request.purpose() == OtpPurpose.PASSWORD_RESET) {
            // Avoid account enumeration: unknown emails still return 200 with no debugOtp.
            String code = userRepository
                    .findByEmailIgnoreCase(request.email().trim())
                    .map(user -> issueOtp(user, OtpPurpose.PASSWORD_RESET, request.channel()))
                    .orElse(null);
            return new OtpResendResponse(authProperties.getOtp().isLogCode() ? code : null);
        }

        User user = requireUserByEmail(request.email());
        String code = issueOtp(user, request.purpose(), request.channel());
        return new OtpResendResponse(authProperties.getOtp().isLogCode() ? code : null);
    }

    @Transactional
    public OtpResendResponse requestPasswordReset(PasswordResetRequestDto request) {
        // Avoid account enumeration: always succeed from API perspective when user missing
        String code = userRepository
                .findByEmailIgnoreCase(request.email().trim())
                .map(user -> issueOtp(user, OtpPurpose.PASSWORD_RESET, OtpChannel.EMAIL))
                .orElse(null);
        return new OtpResendResponse(authProperties.getOtp().isLogCode() ? code : null);
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
        // Inbox ownership proven by OTP — unblock login for incomplete email verification.
        user.setEmailVerified(true);
        if (user.isPhoneVerified() && user.getStatus() == UserStatus.PENDING_VERIFICATION) {
            user.setStatus(UserStatus.ACTIVE);
        }
        userRepository.save(user);

        revokeAllRefreshTokens(user.getId());
        auditRecorder.record(AuditRecord.builder("SECURITY_PASSWORD_RESET")
                .entity("User:" + user.getId())
                .userRef(user.getId())
                .newValue("passwordReset=true;emailVerified=true;refreshTokensRevoked=true")
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
                        currentHash != null && currentHash.equals(t.getTokenHash()),
                        t.getDeviceIdentifier(),
                        t.getDeviceName(),
                        t.getPlatform()))
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

    /**
     * Enforces one active device: revokes every other refresh token, issues a new pair bound to
     * {@code device}, and emails a suspend link when this install has never signed in before.
     */
    private AuthTokensResponse completeLogin(User user, boolean rememberMe, DeviceLoginInfo device) {
        boolean newDevice = device != null
                && !refreshTokenRepository.existsByUserIdAndDeviceIdentifier(
                        user.getId(), device.deviceIdentifier());

        revokeAllRefreshTokens(user.getId());
        AuthTokensResponse tokens = issueTokenPair(user, rememberMe, device);

        if (newDevice) {
            sendNewDeviceLoginAlert(user, device);
        }

        auditRecorder.record(AuditRecord.builder("SECURITY_LOGIN")
                .entity("User:" + user.getId())
                .userRef(user.getId())
                .newValue("singleDevice=true;newDevice="
                        + newDevice
                        + (device == null ? "" : ";device=" + device.deviceIdentifier()))
                .build());
        return tokens;
    }

    private AuthTokensResponse issueTokenPair(User user, boolean rememberMe, DeviceLoginInfo device) {
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
        if (device != null) {
            entity.setDeviceIdentifier(device.deviceIdentifier());
            entity.setDeviceName(device.deviceName());
            entity.setPlatform(device.platform());
        }
        refreshTokenRepository.save(entity);

        return AuthTokensResponse.of(user.getId(), access, refresh);
    }

    private void sendNewDeviceLoginAlert(User user, DeviceLoginInfo device) {
        // 48-byte lock key (~96 hex chars): path-only, never query-string, never under /api.
        String rawToken = TokenHashing.opaqueToken(48);
        AccountSuspendToken row = new AccountSuspendToken();
        row.setUserId(user.getId());
        row.setTokenHash(TokenHashing.sha256(rawToken));
        row.setDeviceIdentifier(device.deviceIdentifier());
        row.setDeviceName(device.deviceName());
        row.setPlatform(device.platform());
        row.setExpiresAt(Instant.now().plus(authProperties.getSuspendTokenTtl()));
        row.setConsumed(false);
        accountSuspendTokenRepository.save(row);

        String base = trimTrailingSlash(authProperties.getPublicBaseUrl());
        String suspendUrl = base + "/secure/account-lock/" + rawToken;
        String deviceLabel = describeDevice(device);
        try {
            var rendered = PalpeerEmailTemplates.newDeviceLogin(
                    user.getEmail(),
                    deviceLabel,
                    ALERT_WHEN.format(Instant.now()),
                    suspendUrl,
                    EmailBrand.SUPPORT_EMAIL);
            emailSender.send(user.getEmail(), rendered.subject(), rendered.text(), rendered.html());
            log.info(
                    "New-device login email sent [userId={}, device={}]",
                    user.getId(),
                    device.deviceIdentifier());
        } catch (RuntimeException ex) {
            log.warn(
                    "New-device login email failed [userId={}, device={}]: {}",
                    user.getId(),
                    device.deviceIdentifier(),
                    ex.getMessage());
        }
    }

    /**
     * HTML form for the emailed lock link. Credentials are entered here — never carried in the
     * URL. Invalid/expired keys still show a form that will fail on submit (no account leak).
     */
    @Transactional(readOnly = true)
    public String suspendAccountFormHtml(String lockKey) {
        String key = lockKey == null ? "" : lockKey.trim();
        String safeAction = HtmlUtils.htmlEscape("/secure/account-lock/" + key);
        return """
                <!DOCTYPE html>
                <html lang="en">
                <head>
                  <meta charset="utf-8"/>
                  <meta name="viewport" content="width=device-width, initial-scale=1"/>
                  <meta name="referrer" content="no-referrer"/>
                  <meta name="robots" content="noindex,nofollow"/>
                  <title>Suspend PALPEER account</title>
                  <style>
                    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
                      background:#0F1A14;color:#F4F6F4;margin:0;padding:24px}
                    .card{max-width:420px;margin:40px auto;background:#14201A;border:1px solid #24352C;
                      border-radius:12px;padding:24px}
                    h1{font-size:1.25rem;margin:0 0 12px}
                    p{color:#A8B5AE;line-height:1.5;font-size:0.95rem}
                    label{display:block;margin:14px 0 6px;font-size:0.85rem;color:#A8B5AE}
                    input{width:100%%;box-sizing:border-box;padding:10px 12px;border-radius:8px;
                      border:1px solid #24352C;background:#1A2921;color:#F4F6F4}
                    button{margin-top:18px;width:100%%;padding:12px;border:0;border-radius:8px;
                      background:#3DD68C;color:#0F1A14;font-weight:600;cursor:pointer}
                    .warn{color:#F5A623;font-size:0.85rem}
                  </style>
                </head>
                <body>
                  <div class="card">
                    <h1>Suspend your account</h1>
                    <p>If you did not authorize the recent sign-in, confirm your identity below.
                      This permanently disables login until support reactivates the account.</p>
                    <p class="warn">Never share your password or PIN. They are not in the email link.</p>
                    <form method="post" action="%s" autocomplete="off">
                      <label for="email">Email</label>
                      <input id="email" name="email" type="email" required autocomplete="username"/>
                      <label for="password">Password</label>
                      <input id="password" name="password" type="password" required autocomplete="current-password"/>
                      <label for="pin">Transaction PIN</label>
                      <input id="pin" name="pin" type="password" inputmode="numeric" required
                        autocomplete="one-time-code"/>
                      <button type="submit">Suspend account</button>
                    </form>
                    <p>Or contact <a href="mailto:%s" style="color:#3DD68C" rel="noreferrer">%s</a>.</p>
                  </div>
                </body>
                </html>
                """
                .formatted(safeAction, EmailBrand.SUPPORT_EMAIL, EmailBrand.SUPPORT_EMAIL);
    }

    /**
     * Suspends the account when the one-time email lock key is valid and email/password/PIN match
     * the user in the database. Revokes all sessions. The lock key alone never authenticates.
     */
    @Transactional
    public void suspendAccount(SuspendAccountRequest request) {
        String rawToken = request.token() == null ? "" : request.token().trim();
        if (!isValidAccountLockKey(rawToken)) {
            throw new BusinessException(
                    "SUSPEND_TOKEN_INVALID",
                    "Suspend link is invalid or already used",
                    HttpStatus.BAD_REQUEST);
        }
        AccountSuspendToken challenge = accountSuspendTokenRepository
                .findByTokenHashAndConsumedFalse(TokenHashing.sha256(rawToken))
                .orElseThrow(() -> new BusinessException(
                        "SUSPEND_TOKEN_INVALID",
                        "Suspend link is invalid or already used",
                        HttpStatus.BAD_REQUEST));

        if (challenge.getExpiresAt().isBefore(Instant.now())) {
            throw new BusinessException(
                    "SUSPEND_TOKEN_EXPIRED", "Suspend link has expired", HttpStatus.BAD_REQUEST);
        }

        User user = userRepository
                .findById(challenge.getUserId())
                .orElseThrow(() -> new BusinessException(
                        "USER_NOT_FOUND", "User not found", HttpStatus.NOT_FOUND));

        String email = request.email().trim().toLowerCase();
        if (!user.getEmail().equalsIgnoreCase(email)) {
            throw new BusinessException(
                    "SUSPEND_CREDENTIALS_INVALID",
                    "Email, password, or PIN does not match",
                    HttpStatus.UNAUTHORIZED);
        }

        if (user.getPasswordHash() == null || user.getPasswordHash().isBlank()) {
            throw new BusinessException(
                    "PASSWORD_LOGIN_UNAVAILABLE",
                    "This account cannot be suspended with a password. Contact support.",
                    HttpStatus.BAD_REQUEST);
        }
        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new BusinessException(
                    "SUSPEND_CREDENTIALS_INVALID",
                    "Email, password, or PIN does not match",
                    HttpStatus.UNAUTHORIZED);
        }

        TransactionPinMatcher pins = pinMatcher.getIfAvailable();
        if (pins == null || !pins.hasPin(user.getId())) {
            throw new BusinessException(
                    "PIN_NOT_SET",
                    "Set a transaction PIN in the app before using emergency suspend, or contact support.",
                    HttpStatus.CONFLICT);
        }
        if (!pins.matches(user.getId(), request.pin())) {
            throw new BusinessException(
                    "SUSPEND_CREDENTIALS_INVALID",
                    "Email, password, or PIN does not match",
                    HttpStatus.UNAUTHORIZED);
        }

        challenge.setConsumed(true);
        challenge.setConsumedAt(Instant.now());
        accountSuspendTokenRepository.save(challenge);

        user.setEnabled(false);
        user.setStatus(UserStatus.SUSPENDED);
        userRepository.save(user);
        revokeAllRefreshTokens(user.getId());

        auditRecorder.record(AuditRecord.builder("SECURITY_ACCOUNT_SUSPEND_SELF")
                .entity("User:" + user.getId())
                .userRef(user.getId())
                .newValue("status=SUSPENDED;enabled=false;via=newDeviceAlert")
                .build());
    }

    private static String describeDevice(DeviceLoginInfo device) {
        StringBuilder label = new StringBuilder();
        if (device.deviceName() != null) {
            label.append(device.deviceName());
        }
        if (device.platform() != null) {
            if (!label.isEmpty()) {
                label.append(" · ");
            }
            label.append(device.platform());
        }
        if (label.isEmpty()) {
            label.append("device ").append(device.deviceIdentifier());
        }
        return label.toString();
    }

    /**
     * Lock keys are hex-only path segments (64–128 chars). Rejects junk before any DB lookup so
     * probing cannot use this as a generic backend oracle.
     */
    static boolean isValidAccountLockKey(String lockKey) {
        if (lockKey == null) {
            return false;
        }
        int len = lockKey.length();
        if (len < 64 || len > 128) {
            return false;
        }
        for (int i = 0; i < len; i++) {
            char c = lockKey.charAt(i);
            if ((c < '0' || c > '9') && (c < 'a' || c > 'f')) {
                return false;
            }
        }
        return true;
    }

    private static String trimTrailingSlash(String url) {
        if (url == null || url.isBlank()) {
            return "http://localhost:8085";
        }
        String trimmed = url.trim();
        while (trimmed.endsWith("/")) {
            trimmed = trimmed.substring(0, trimmed.length() - 1);
        }
        return trimmed;
    }

    private String issueOtp(User user, OtpPurpose purpose, OtpChannel channel) {
        String destination = channel == OtpChannel.EMAIL ? user.getEmail() : user.getPhone();
        return persistAndSendOtp(user.getId(), destination, purpose, channel);
    }

    private String issuePhonePreRegisterOtp(String phone) {
        return persistAndSendOtp(null, phone, OtpPurpose.PHONE_VERIFICATION, OtpChannel.SMS);
    }

    private String persistAndSendOtp(
            UUID userId, String destination, OtpPurpose purpose, OtpChannel channel) {
        String code = TokenHashing.numericCode(authProperties.getOtp().getLength());

        OtpChallenge challenge = new OtpChallenge();
        challenge.setUserId(userId);
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

    private boolean consumeFreshPhonePreVerification(String phone) {
        Optional<PhonePreVerification> opt = phonePreVerificationRepository.findByPhone(phone);
        if (opt.isEmpty()) {
            return false;
        }
        PhonePreVerification row = opt.get();
        boolean fresh = row.getExpiresAt().isAfter(Instant.now());
        phonePreVerificationRepository.delete(row);
        return fresh;
    }

    private boolean hasFreshPhonePreVerification(String phone) {
        return phonePreVerificationRepository
                .findByPhone(phone)
                .filter(row -> row.getExpiresAt() != null && row.getExpiresAt().isAfter(Instant.now()))
                .isPresent();
    }

    private SignupStatusResponse statusForUser(String phone, User user) {
        boolean hasLoggedIn = refreshTokenRepository.existsByUserId(user.getId());
        String email = user.getEmail();
        String masked = maskEmail(email);
        if (!user.isEnabled()
                || user.getStatus() == UserStatus.SUSPENDED
                || user.getStatus() == UserStatus.CLOSED) {
            return new SignupStatusResponse(
                    SignupStatusResponse.BLOCKED,
                    phone,
                    email,
                    masked,
                    user.isEmailVerified(),
                    user.isPhoneVerified(),
                    hasLoggedIn,
                    user.getStatus().name());
        }
        if (!user.isEmailVerified()) {
            return new SignupStatusResponse(
                    SignupStatusResponse.EMAIL_OTP_REQUIRED,
                    phone,
                    email,
                    masked,
                    false,
                    user.isPhoneVerified(),
                    hasLoggedIn,
                    user.getStatus().name());
        }
        return new SignupStatusResponse(
                SignupStatusResponse.LOGIN_READY,
                phone,
                email,
                masked,
                true,
                user.isPhoneVerified(),
                hasLoggedIn,
                user.getStatus().name());
    }

    static String maskEmail(String email) {
        if (email == null || email.isBlank() || !email.contains("@")) {
            return null;
        }
        String trimmed = email.trim();
        int at = trimmed.indexOf('@');
        String local = trimmed.substring(0, at);
        String domain = trimmed.substring(at);
        if (local.length() <= 1) {
            return "*" + domain;
        }
        return local.charAt(0) + "***" + domain;
    }

    private static String normalizePhone(String phone) {
        if (phone == null || phone.isBlank()) {
            throw new BusinessException("PHONE_REQUIRED", "Phone is required", HttpStatus.BAD_REQUEST);
        }
        return phone.trim().replaceAll("[\\s()-]", "");
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
