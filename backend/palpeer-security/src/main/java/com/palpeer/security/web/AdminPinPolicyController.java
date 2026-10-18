package com.palpeer.security.web;

import com.palpeer.auth.security.UserPrincipal;
import com.palpeer.common.api.ApiResponse;
import com.palpeer.security.service.PinPolicyService;
import com.palpeer.security.web.dto.PinPolicyResponse;
import com.palpeer.security.web.dto.UpdatePinPolicyRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/settings/pin-policy")
@RequiredArgsConstructor
@Tag(name = "Admin PIN Policy")
@SecurityRequirement(name = "bearerAuth")
@PreAuthorize("hasAuthority('ROLE_ADMIN')")
public class AdminPinPolicyController {

    private final PinPolicyService pinPolicyService;

    @GetMapping
    @PreAuthorize("hasAuthority('admin:manage')")
    @Operation(summary = "Get wrong-PIN attempt limit and lockout hours")
    public ApiResponse<PinPolicyResponse> get() {
        return ApiResponse.ok(pinPolicyService.getPolicy());
    }

    @PutMapping
    @PreAuthorize("hasAuthority('admin:manage')")
    @Operation(summary = "Update wrong-PIN attempt limit and lockout hours")
    public ApiResponse<PinPolicyResponse> update(
            @AuthenticationPrincipal UserPrincipal principal, @Valid @RequestBody UpdatePinPolicyRequest request) {
        return ApiResponse.ok("PIN policy updated", pinPolicyService.updatePolicy(principal.getId(), request));
    }
}
