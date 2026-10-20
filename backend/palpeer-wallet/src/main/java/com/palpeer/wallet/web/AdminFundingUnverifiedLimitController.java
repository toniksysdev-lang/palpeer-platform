package com.palpeer.wallet.web;

import com.palpeer.auth.security.UserPrincipal;
import com.palpeer.common.api.ApiResponse;
import com.palpeer.wallet.service.FundingUnverifiedLimitService;
import com.palpeer.wallet.web.dto.FundingUnverifiedLimitResponse;
import com.palpeer.wallet.web.dto.UpsertFundingUnverifiedLimitRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/settings/funding-unverified-limits")
@RequiredArgsConstructor
@Tag(name = "Admin Funding Unverified Limits")
@SecurityRequirement(name = "bearerAuth")
@PreAuthorize("hasAuthority('ROLE_ADMIN')")
public class AdminFundingUnverifiedLimitController {

    private final FundingUnverifiedLimitService fundingUnverifiedLimitService;

    @GetMapping
    @PreAuthorize("hasAnyAuthority('wallets:read', 'admin:manage')")
    @Operation(summary = "List per-wallet amounts fundable without identity verification")
    public ApiResponse<List<FundingUnverifiedLimitResponse>> list() {
        return ApiResponse.ok(fundingUnverifiedLimitService.listForWallets());
    }

    @PutMapping
    @PreAuthorize("hasAuthority('admin:manage')")
    @Operation(summary = "Set the unverified funding ceiling for a wallet currency")
    public ApiResponse<FundingUnverifiedLimitResponse> upsert(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody UpsertFundingUnverifiedLimitRequest request) {
        return ApiResponse.ok(
                "Unverified funding limit saved",
                fundingUnverifiedLimitService.upsert(principal.getId(), request));
    }
}
