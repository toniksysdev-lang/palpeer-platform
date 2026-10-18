package com.palpeer.wallet.web;

import com.palpeer.common.api.ApiResponse;
import com.palpeer.wallet.service.PoolFundsService;
import com.palpeer.wallet.web.dto.PoolFundsBalanceResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/pool-funds")
@RequiredArgsConstructor
@Tag(name = "Admin Pool Funds")
@SecurityRequirement(name = "bearerAuth")
@PreAuthorize("hasAuthority('ROLE_ADMIN')")
public class AdminPoolFundsController {

    private final PoolFundsService poolFundsService;

    @GetMapping
    @PreAuthorize("hasAuthority('wallets:read')")
    @Operation(summary = "Pool funds from funding/withdrawals/InstantEX (+ live provider balances)")
    public ApiResponse<PoolFundsBalanceResponse> balances() {
        return ApiResponse.ok(poolFundsService.balances());
    }
}
