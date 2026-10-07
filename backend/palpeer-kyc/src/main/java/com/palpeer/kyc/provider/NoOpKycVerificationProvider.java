package com.palpeer.kyc.provider;

import java.util.Optional;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Local-only KYC when ComplyCube is disabled.
 */
@Slf4j
@Component
@ConditionalOnProperty(prefix = "palpeer.complycube", name = "enabled", havingValue = "false", matchIfMissing = true)
public class NoOpKycVerificationProvider implements KycVerificationProvider {

    @Override
    public String providerName() {
        return "NONE";
    }

    @Override
    public boolean isEnabled() {
        return false;
    }

    @Override
    public String ensureClient(EnsureClientRequest request) {
        throw unsupported();
    }

    @Override
    public String createDocument(String providerClientId, String documentType, String issuingCountry) {
        throw unsupported();
    }

    @Override
    public void uploadDocumentImage(String providerDocumentId, String side, String fileName, byte[] bytes) {
        throw unsupported();
    }

    @Override
    public String uploadLivePhoto(String providerClientId, String fileName, byte[] bytes) {
        throw unsupported();
    }

    @Override
    public String createIdentityCheck(String providerClientId, String providerDocumentId, String livePhotoId) {
        throw unsupported();
    }

    @Override
    public String createDocumentCheck(String providerClientId, String providerDocumentId) {
        throw unsupported();
    }

    @Override
    public Optional<ProviderCheckResult> getCheck(String providerCheckId) {
        return Optional.empty();
    }

    private static UnsupportedOperationException unsupported() {
        return new UnsupportedOperationException("ComplyCube is disabled — set COMPLYCUBE_ENABLED=true");
    }
}
