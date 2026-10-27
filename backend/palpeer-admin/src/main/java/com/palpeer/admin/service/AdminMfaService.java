package com.palpeer.admin.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.palpeer.admin.config.AdminSecurityProperties;
import com.palpeer.admin.domain.AdminMfaTotp;
import com.palpeer.admin.repository.AdminMfaTotpRepository;
import com.palpeer.admin.repository.AdminUserRepository;
import com.palpeer.admin.web.dto.AdminMfaEnableResponse;
import com.palpeer.admin.web.dto.AdminMfaSetupResponse;
import com.palpeer.admin.web.dto.AdminMfaStatusResponse;
import com.palpeer.auth.spi.AdminMfaGate;
import com.palpeer.auth.totp.TotpSecretCrypto;
import com.palpeer.auth.totp.TotpSupport;
import com.palpeer.auth.util.TokenHashing;
import com.palpeer.common.audit.AuditRecord;
import com.palpeer.common.audit.AuditRecorder;
import com.palpeer.common.exception.BusinessException;
import com.palpeer.user.domain.User;
import com.palpeer.user.repository.UserRepository;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AdminMfaService implements AdminMfaGate {

    private static final String ISSUER = "Palpeer Admin";
    private static final int RECOVERY_CODE_COUNT = 8;
    private static final char[] RECOVERY_ALPHABET =
            "ABCDEFGHJKLMNPQRSTUVWXYZ23456789".toCharArray();
    private static final SecureRandom RANDOM = new SecureRandom();

    private final AdminMfaTotpRepository mfaRepository;
    private final AdminUserRepository adminUserRepository;
    private final UserRepository userRepository;
    private final TotpSecretCrypto secretCrypto;
    private final PasswordEncoder passwordEncoder;
    private final AuditRecorder auditRecorder;
    private final Clock clock;
    private final AdminSecurityProperties adminSecurityProperties;
    private final ObjectMapper objectMapper;

    @Override
    @Transactional(readOnly = true)
    public boolean isMfaRequired(UUID userId) {
        return adminUserRepository.findByUserIdAndEnabledTrue(userId).isPresent()
                && mfaRepository.existsByUserIdAndEnabledTrue(userId);
    }

    @Transactional(readOnly = true)
    public boolean isEnrollmentRequired(UUID userId) {
        if (!adminSecurityProperties.isMfaRequired()) {
            return false;
        }
        if (adminUserRepository.findByUserIdAndEnabledTrue(userId).isEmpty()) {
            return false;
        }
        return !mfaRepository.existsByUserIdAndEnabledTrue(userId);
    }

    @Override
    @Transactional
    public boolean verifySecondFactor(UUID userId, String code) {
        AdminMfaTotp row = mfaRepository.findByUserId(userId).filter(AdminMfaTotp::isEnabled).orElse(null);
        if (row == null || code == null) {
            return false;
        }
        String trimmed = code.trim();
        if (trimmed.matches("\\d{6}")) {
            return TotpSupport.verify(
                    secretCrypto.decrypt(row.getSecretCiphertext()), trimmed, clock.instant(), 1);
        }
        return consumeRecoveryCode(row, trimmed);
    }

    @Transactional(readOnly = true)
    public AdminMfaStatusResponse status(UUID userId) {
        requireAdmin(userId);
        return mfaRepository
                .findByUserId(userId)
                .map(row -> new AdminMfaStatusResponse(
                        row.isEnabled(), row.getEnabledAt(), readHashes(row).size(), isEnrollmentRequired(userId)))
                .orElseGet(() -> new AdminMfaStatusResponse(false, null, 0, isEnrollmentRequired(userId)));
    }

    @Transactional
    public AdminMfaSetupResponse beginSetup(UUID userId) {
        requireAdmin(userId);
        User user = userRepository
                .findById(userId)
                .orElseThrow(() -> new BusinessException("USER_NOT_FOUND", "User not found", HttpStatus.NOT_FOUND));

        String secret = TotpSupport.generateSecret();
        AdminMfaTotp row = mfaRepository.findByUserId(userId).orElseGet(AdminMfaTotp::new);
        row.setUserId(userId);
        row.setSecretCiphertext(secretCrypto.encrypt(secret));
        row.setEnabled(false);
        row.setEnabledAt(null);
        row.setRecoveryCodeHashes(null);
        mfaRepository.save(row);

        return new AdminMfaSetupResponse(secret, TotpSupport.otpAuthUri(ISSUER, user.getEmail(), secret));
    }

    @Transactional
    public AdminMfaEnableResponse confirmSetup(UUID userId, String code) {
        requireAdmin(userId);
        AdminMfaTotp row = mfaRepository
                .findByUserId(userId)
                .orElseThrow(() -> new BusinessException(
                        "MFA_SETUP_REQUIRED", "Start MFA setup before confirming", HttpStatus.BAD_REQUEST));
        if (row.isEnabled()) {
            return new AdminMfaEnableResponse(true, row.getEnabledAt(), List.of(), readHashes(row).size());
        }
        String secret = secretCrypto.decrypt(row.getSecretCiphertext());
        if (!TotpSupport.verify(secret, code, clock.instant(), 1)) {
            throw new BusinessException("MFA_INVALID", "Invalid authenticator code", HttpStatus.BAD_REQUEST);
        }
        List<String> plaintext = generateRecoveryCodes();
        Instant now = clock.instant();
        row.setEnabled(true);
        row.setEnabledAt(now);
        row.setRecoveryCodeHashes(writeHashes(plaintext.stream().map(TokenHashing::sha256).toList()));
        mfaRepository.save(row);
        auditRecorder.record(AuditRecord.builder("ADMIN_MFA_ENABLED")
                .entity("AdminMfaTotp:" + row.getId())
                .userRef(userId)
                .newValue("enabled=true;recoveryCodes=" + plaintext.size())
                .build());
        return new AdminMfaEnableResponse(true, now, plaintext, plaintext.size());
    }

    @Transactional
    public AdminMfaStatusResponse disable(UUID userId, String password, String code) {
        requireAdmin(userId);
        User user = userRepository
                .findById(userId)
                .orElseThrow(() -> new BusinessException("USER_NOT_FOUND", "User not found", HttpStatus.NOT_FOUND));
        if (user.getPasswordHash() == null
                || user.getPasswordHash().isBlank()
                || !passwordEncoder.matches(password, user.getPasswordHash())) {
            throw new BusinessException("INVALID_CREDENTIALS", "Invalid credentials", HttpStatus.UNAUTHORIZED);
        }
        AdminMfaTotp row = mfaRepository
                .findByUserId(userId)
                .filter(AdminMfaTotp::isEnabled)
                .orElseThrow(() -> new BusinessException("MFA_NOT_ENABLED", "MFA is not enabled", HttpStatus.BAD_REQUEST));
        if (!verifySecondFactor(userId, code)) {
            throw new BusinessException("MFA_INVALID", "Invalid authenticator or recovery code", HttpStatus.BAD_REQUEST);
        }
        mfaRepository.delete(row);
        auditRecorder.record(AuditRecord.builder("ADMIN_MFA_DISABLED")
                .entity("User:" + userId)
                .userRef(userId)
                .newValue("enabled=false")
                .build());
        return new AdminMfaStatusResponse(false, null, 0, isEnrollmentRequired(userId));
    }

    private boolean consumeRecoveryCode(AdminMfaTotp row, String code) {
        String normalized = code.trim().toUpperCase(Locale.ROOT).replace(" ", "");
        String hash = TokenHashing.sha256(normalized);
        List<String> hashes = new ArrayList<>(readHashes(row));
        Iterator<String> it = hashes.iterator();
        boolean matched = false;
        while (it.hasNext()) {
            if (it.next().equalsIgnoreCase(hash)) {
                it.remove();
                matched = true;
                break;
            }
        }
        if (!matched) {
            return false;
        }
        row.setRecoveryCodeHashes(writeHashes(hashes));
        mfaRepository.save(row);
        auditRecorder.record(AuditRecord.builder("ADMIN_MFA_RECOVERY_USED")
                .entity("AdminMfaTotp:" + row.getId())
                .userRef(row.getUserId())
                .newValue("remaining=" + hashes.size())
                .build());
        return true;
    }

    private List<String> generateRecoveryCodes() {
        List<String> codes = new ArrayList<>(RECOVERY_CODE_COUNT);
        for (int i = 0; i < RECOVERY_CODE_COUNT; i++) {
            codes.add(randomChunk(4) + "-" + randomChunk(4));
        }
        return codes;
    }

    private static String randomChunk(int length) {
        StringBuilder sb = new StringBuilder(length);
        for (int i = 0; i < length; i++) {
            sb.append(RECOVERY_ALPHABET[RANDOM.nextInt(RECOVERY_ALPHABET.length)]);
        }
        return sb.toString();
    }

    private List<String> readHashes(AdminMfaTotp row) {
        String raw = row.getRecoveryCodeHashes();
        if (raw == null || raw.isBlank()) {
            return List.of();
        }
        try {
            return objectMapper.readValue(raw, new TypeReference<>() {});
        } catch (Exception ex) {
            return List.of();
        }
    }

    private String writeHashes(List<String> hashes) {
        try {
            return objectMapper.writeValueAsString(hashes);
        } catch (Exception ex) {
            throw new IllegalStateException("Failed to serialize recovery code hashes", ex);
        }
    }

    private void requireAdmin(UUID userId) {
        adminUserRepository
                .findByUserIdAndEnabledTrue(userId)
                .orElseThrow(() -> new BusinessException(
                        "NOT_ADMIN", "Admin access required", HttpStatus.FORBIDDEN));
    }
}
