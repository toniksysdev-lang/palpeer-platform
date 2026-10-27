package com.palpeer.admin.web;

import com.palpeer.admin.service.AdminMfaService;
import com.palpeer.admin.web.dto.AdminMfaCodeRequest;
import com.palpeer.admin.web.dto.AdminMfaDisableRequest;
import com.palpeer.admin.web.dto.AdminMfaEnableResponse;
import com.palpeer.admin.web.dto.AdminMfaSetupResponse;
import com.palpeer.admin.web.dto.AdminMfaStatusResponse;
import com.palpeer.auth.security.UserPrincipal;
import com.palpeer.common.api.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/mfa")
@RequiredArgsConstructor
@Tag(name = "Admin MFA")
@SecurityRequirement(name = "bearerAuth")
public class AdminMfaController {

    private final AdminMfaService adminMfaService;

    @GetMapping
    @Operation(summary = "Admin TOTP MFA status")
    public ApiResponse<AdminMfaStatusResponse> status(@AuthenticationPrincipal UserPrincipal principal) {
        return ApiResponse.ok(adminMfaService.status(principal.getId()));
    }

    @PostMapping("/setup")
    @Operation(summary = "Begin TOTP enrollment (returns secret + otpauth URL)")
    public ApiResponse<AdminMfaSetupResponse> setup(@AuthenticationPrincipal UserPrincipal principal) {
        return ApiResponse.ok(adminMfaService.beginSetup(principal.getId()));
    }

    @PostMapping("/enable")
    @Operation(summary = "Confirm TOTP enrollment with a code from the authenticator app")
    public ApiResponse<AdminMfaEnableResponse> enable(
            @AuthenticationPrincipal UserPrincipal principal, @Valid @RequestBody AdminMfaCodeRequest request) {
        return ApiResponse.ok(adminMfaService.confirmSetup(principal.getId(), request.code()));
    }

    @PostMapping("/disable")
    @Operation(summary = "Disable TOTP MFA (requires password + current code)")
    public ApiResponse<AdminMfaStatusResponse> disable(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody AdminMfaDisableRequest request) {
        return ApiResponse.ok(adminMfaService.disable(principal.getId(), request.password(), request.code()));
    }
}
