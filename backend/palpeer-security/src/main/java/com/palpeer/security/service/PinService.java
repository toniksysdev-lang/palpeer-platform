package com.palpeer.security.service;

import com.palpeer.common.audit.AuditRecord;
import com.palpeer.common.audit.AuditRecorder;
import com.palpeer.common.exception.BusinessException;
import com.palpeer.common.exception.ResourceNotFoundException;
import com.palpeer.security.domain.PinCredential;
import com.palpeer.security.repository.PinCredentialRepository;
import com.palpeer.security.repository.SecurityQuestionRepository;
import com.palpeer.security.web.dto.ChangePinRequest;
import com.palpeer.security.web.dto.PinStatusResponse;
import com.palpeer.security.web.dto.ResetPinRequest;
import com.palpeer.security.web.dto.SetPinRequest;
import com.palpeer.security.web.dto.VerifyPinRequest;
import java.time.Clock;
import java.time.Instant;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class PinService {

    private final PinCredentialRepository pinCredentialRepository;
    private final SecurityQuestionRepository securityQuestionRepository;
    private final PasswordEncoder passwordEncoder;
    private final SecurityQuestionService securityQuestionService;
    private final AuditRecorder auditRecorder;
    private final PinAttemptGuard attemptGuard;
    private final Clock clock;

    @Transactional(readOnly = true)
    public PinStatusResponse status(UUID userId) {
        return pinCredentialRepository.findByUserId(userId)
                .map(credential -> new PinStatusResponse(true, activeLock(credential)))
                .orElseGet(() -> new PinStatusResponse(false, null));
    }

    @Transactional
    public void setPin(UUID userId, SetPinRequest request) {
        if (pinCredentialRepository.existsByUserId(userId)) {
            throw new BusinessException("PIN_ALREADY_SET", "PIN already set; use change or reset", HttpStatus.CONFLICT);
        }
        PinCredential credential = new PinCredential();
        credential.setUserId(userId);
        credential.setPinHash(passwordEncoder.encode(request.pin()));
        pinCredentialRepository.save(credential);
        auditRecorder.record(AuditRecord.builder("SECURITY_PIN_SET")
                .entity("PinCredential:" + credential.getId())
                .userRef(userId)
                .newValue("pinSet=true")
                .build());
    }

    @Transactional
    public void changePin(UUID userId, ChangePinRequest request) {
        attemptGuard.reserve(userId);
        PinCredential credential = requirePin(userId);
        if (!passwordEncoder.matches(request.currentPin(), credential.getPinHash())) {
            throw failure(userId, "PIN_INVALID", "Current PIN is invalid");
        }
        credential.setPinHash(passwordEncoder.encode(request.newPin()));
        clearLock(credential);
        pinCredentialRepository.save(credential);
        auditRecorder.record(AuditRecord.builder("SECURITY_PIN_CHANGE")
                .entity("PinCredential:" + credential.getId())
                .userRef(userId)
                .newValue("pinChanged=true")
                .build());
    }

    /**
     * Reset PIN using security-question answers. Wrong answers count toward the PIN lockout,
     * otherwise reset would be an unlimited side door around it.
     * CONTRACT_PENDING (P3-04): confirm reset factors (questions vs OTP vs password).
     */
    @Transactional
    public void resetPin(UUID userId, ResetPinRequest request) {
        if (securityQuestionRepository.countByUserId(userId) == 0) {
            throw new BusinessException(
                    "SECURITY_QUESTIONS_REQUIRED",
                    "Security questions must be configured before PIN reset",
                    HttpStatus.CONFLICT);
        }
        if (!pinCredentialRepository.existsByUserId(userId)) {
            throw new BusinessException(
                    "PIN_NOT_SET",
                    "PIN must be set before it can be reset",
                    HttpStatus.CONFLICT);
        }

        attemptGuard.reserve(userId);
        try {
            securityQuestionService.verifyAnswers(userId, request.answers());
        } catch (BusinessException wrongAnswers) {
            if (attemptGuard.recordFailure(userId)) {
                throw PinAttemptGuard.locked();
            }
            throw wrongAnswers;
        }

        PinCredential credential = requirePin(userId);
        credential.setPinHash(passwordEncoder.encode(request.newPin()));
        clearLock(credential);
        pinCredentialRepository.save(credential);
        auditRecorder.record(AuditRecord.builder("SECURITY_PIN_RESET")
                .entity("PinCredential:" + credential.getId())
                .userRef(userId)
                .newValue("pinReset=true")
                .build());
    }

    public void verifyPin(UUID userId, VerifyPinRequest request) {
        attemptGuard.reserve(userId);
        PinCredential credential = requirePin(userId);
        if (!passwordEncoder.matches(request.pin(), credential.getPinHash())) {
            throw failure(userId, "PIN_INVALID", "PIN is invalid");
        }
        attemptGuard.recordSuccess(userId);
    }

    private BusinessException failure(UUID userId, String code, String message) {
        if (attemptGuard.recordFailure(userId)) {
            return PinAttemptGuard.locked();
        }
        return new BusinessException(code, message, HttpStatus.UNAUTHORIZED);
    }

    private Instant activeLock(PinCredential credential) {
        Instant lockedUntil = credential.getLockedUntil();
        return lockedUntil != null && lockedUntil.isAfter(clock.instant()) ? lockedUntil : null;
    }

    private static void clearLock(PinCredential credential) {
        credential.setFailedAttempts(0);
        credential.setLockedUntil(null);
    }

    private PinCredential requirePin(UUID userId) {
        return pinCredentialRepository.findByUserId(userId)
                .orElseThrow(() -> new ResourceNotFoundException("PIN not set"));
    }
}
