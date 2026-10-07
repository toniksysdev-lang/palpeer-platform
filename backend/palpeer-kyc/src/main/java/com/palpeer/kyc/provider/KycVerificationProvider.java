package com.palpeer.kyc.provider;

import java.util.Optional;

/**
 * External KYC / identity verification adapter.
 * Confirmed vendor: ComplyCube (https://www.complycube.com/en/developers/).
 */
public interface KycVerificationProvider {

    String providerName();

    boolean isEnabled();

    /**
     * Ensures a remote client exists for the user and returns the provider client id.
     */
    String ensureClient(EnsureClientRequest request);

    String createDocument(String providerClientId, String documentType, String issuingCountry);

    void uploadDocumentImage(String providerDocumentId, String side, String fileName, byte[] bytes);

    String uploadLivePhoto(String providerClientId, String fileName, byte[] bytes);

    String createIdentityCheck(String providerClientId, String providerDocumentId, String livePhotoId);

    String createDocumentCheck(String providerClientId, String providerDocumentId);

    Optional<ProviderCheckResult> getCheck(String providerCheckId);

    record EnsureClientRequest(
            String externalUserId,
            String email,
            String phone,
            String firstName,
            String lastName,
            String dateOfBirth
    ) {
    }

    record ProviderCheckResult(
            String checkId,
            String type,
            String status,
            String result,
            String breakdown
    ) {
    }
}
