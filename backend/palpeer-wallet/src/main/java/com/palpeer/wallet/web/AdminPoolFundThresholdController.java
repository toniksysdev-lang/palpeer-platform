package com.palpeer.wallet.web;

import com.palpeer.auth.security.UserPrincipal;
import com.palpeer.common.api.ApiResponse;
import com.palpeer.wallet.service.PoolFundThresholdService;
import com.palpeer.wallet.web.dto.PoolFundThresholdResponse;
import com.palpeer.wallet.web.dto.UpsertPoolFundThresholdRequest;
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
@RequestMapping("/api/v1/admin/settings/pool-fund-thresholds")
@RequiredArgsConstructor
@Tag(name = "Admin Pool Fund Thresholds")
@SecurityRequirement(name = "bearerAuth")
@PreAuthorize("hasAuthority('ROLE_ADMIN')")
public class AdminPoolFundThresholdController {

    private final PoolFundThresholdService poolFundThresholdService;

    @GetMapping
    @PreAuthorize("hasAnyAuthority('wallets:read', 'admin:manage')")
    @Operation(summary = "List pool funds with threshold notice settings")
    public ApiResponse<List<PoolFundThresholdResponse>> list() {
        return ApiResponse.ok(poolFundThresholdService.listWithBalances());
    }

    @PutMapping
    @PreAuthorize("hasAuthority('admin:manage')")
    @Operation(summary = "Create or update a pool fund balance threshold notice")
    public ApiResponse<PoolFundThresholdResponse> upsert(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody UpsertPoolFundThresholdRequest request) {
        return ApiResponse.ok(
                "Pool fund threshold saved",
                poolFundThresholdService.upsert(principal.getId(), request));
    }
}
