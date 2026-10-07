package com.palpeer.kyc.web.dto;

/**
 * Raw KYC artifact bytes for admin inline viewing.
 */
public record KycFileContent(
        String contentType,
        String filename,
        byte[] bytes
) {
}
