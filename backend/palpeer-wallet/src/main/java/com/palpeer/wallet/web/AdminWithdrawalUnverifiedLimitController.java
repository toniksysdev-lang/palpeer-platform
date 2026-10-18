package com.palpeer.wallet.web;

import com.palpeer.auth.security.UserPrincipal;
import com.palpeer.common.api.ApiResponse;
import com.palpeer.wallet.service.WithdrawalUnverifiedLimitService;
import com.palpeer.wallet.web.dto.UpsertWithdrawalUnverifiedLimitRequest;
import com.palpeer.wallet.web.dto.WithdrawalUnverifiedLimitResponse;
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
@RequestMapping("/api/v1/admin/settings/withdrawal-unverified-limits")
@RequiredArgsConstructor
@Tag(name = "Admin Withdrawal Unverified Limits")
@SecurityRequirement(name = "bearerAuth")
@PreAuthorize("hasAuthority('ROLE_ADMIN')")
public class AdminWithdrawalUnverifiedLimitController {

    private final WithdrawalUnverifiedLimitService withdrawalUnverifiedLimitService;

    @GetMapping
    @PreAuthorize("hasAnyAuthority('wallets:read', 'admin:manage')")
    @Operation(summary = "List per-wallet amounts withdrawable without identity verification")
    public ApiResponse<List<WithdrawalUnverifiedLimitResponse>> list() {
        return ApiResponse.ok(withdrawalUnverifiedLimitService.listForWallets());
    }

    @PutMapping
    @PreAuthorize("hasAuthority('admin:manage')")
    @Operation(summary = "Set the unverified withdrawal ceiling for a wallet currency")
    public ApiResponse<WithdrawalUnverifiedLimitResponse> upsert(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody UpsertWithdrawalUnverifiedLimitRequest request) {
        return ApiResponse.ok(
                "Unverified withdrawal limit saved",
                withdrawalUnverifiedLimitService.upsert(principal.getId(), request));
    }
}
