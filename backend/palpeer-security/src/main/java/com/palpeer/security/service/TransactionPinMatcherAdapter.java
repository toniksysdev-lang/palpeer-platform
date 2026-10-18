package com.palpeer.security.service;

import com.palpeer.auth.spi.TransactionPinMatcher;
import com.palpeer.security.repository.PinCredentialRepository;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class TransactionPinMatcherAdapter implements TransactionPinMatcher {

    private final PinCredentialRepository pinCredentialRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public boolean hasPin(UUID userId) {
        return pinCredentialRepository.existsByUserId(userId);
    }

    @Override
    public boolean matches(UUID userId, String rawPin) {
        if (rawPin == null || rawPin.isBlank()) {
            return false;
        }
        return pinCredentialRepository
                .findByUserId(userId)
                .map(credential -> passwordEncoder.matches(rawPin, credential.getPinHash()))
                .orElse(false);
    }
}
