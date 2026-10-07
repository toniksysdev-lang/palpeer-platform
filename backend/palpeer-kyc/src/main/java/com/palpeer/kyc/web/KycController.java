package com.palpeer.kyc.web;

import com.palpeer.auth.security.UserPrincipal;
import com.palpeer.common.api.ApiResponse;
import com.palpeer.kyc.service.KycService;
import com.palpeer.kyc.web.dto.KycDocumentResponse;
import com.palpeer.kyc.web.dto.KycProgressResponse;
import com.palpeer.kyc.web.dto.KycStatusResponse;
import com.palpeer.kyc.web.dto.KycVerificationResponse;
import com.palpeer.kyc.web.dto.SelfieResponse;
import com.palpeer.kyc.web.dto.StartKycVerificationRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/kyc")
@RequiredArgsConstructor
@Tag(name = "KYC")
@SecurityRequirement(name = "bearerAuth")
public class KycController {

    private final KycService kycService;

    @PostMapping(value = "/documents", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Upload KYC document")
    public ApiResponse<KycDocumentResponse> uploadDocument(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam("documentType") String documentType,
            @RequestPart("file") MultipartFile file) {
        return ApiResponse.ok("Document uploaded", kycService.uploadDocument(principal.getId(), documentType, file));
    }

    @PostMapping(value = "/selfie", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Upload KYC selfie")
    public ApiResponse<SelfieResponse> uploadSelfie(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestPart("file") MultipartFile file) {
        return ApiResponse.ok("Selfie uploaded", kycService.uploadSelfie(principal.getId(), file));
    }

    @GetMapping("/status")
    @Operation(summary = "Get KYC status")
    public ApiResponse<KycStatusResponse> status(@AuthenticationPrincipal UserPrincipal principal) {
        return ApiResponse.ok(kycService.getStatus(principal.getId()));
    }

    @GetMapping("/progress")
    @Operation(summary = "Get KYC progress")
    public ApiResponse<KycProgressResponse> progress(@AuthenticationPrincipal UserPrincipal principal) {
        return ApiResponse.ok(kycService.getProgress(principal.getId()));
    }

    @PostMapping("/verification/start")
    @ResponseStatus(HttpStatus.ACCEPTED)
    @Operation(summary = "Start ComplyCube verification for uploaded document/selfie")
    public ApiResponse<KycVerificationResponse> startVerification(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody StartKycVerificationRequest request) {
        return ApiResponse.ok(
                "Verification submitted to ComplyCube",
                kycService.startVerification(principal.getId(), request));
    }
}
