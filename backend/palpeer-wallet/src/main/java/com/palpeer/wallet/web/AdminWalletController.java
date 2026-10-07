package com.palpeer.wallet.web;

import com.palpeer.common.api.ApiResponse;
import com.palpeer.wallet.service.WalletService;
import com.palpeer.wallet.web.dto.LedgerTransactionResponse;
import com.palpeer.wallet.web.dto.WalletResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Admin inventory for wallets — read-only, no ownership checks.
 */
@RestController
@RequestMapping("/api/v1/admin/wallets")
@RequiredArgsConstructor
@Tag(name = "Admin Wallets")
@SecurityRequirement(name = "bearerAuth")
@PreAuthorize("hasAuthority('ROLE_ADMIN')")
public class AdminWalletController {

    private final WalletService walletService;

    @GetMapping
    @PreAuthorize("hasAuthority('wallets:read')")
    @Operation(summary = "List all wallets (admin inventory)")
    public ApiResponse<Page<WalletResponse>> list(
            @RequestParam(required = false) UUID userId,
            @RequestParam(required = false) String currencyCode,
            @PageableDefault(size = 20, sort = "createdAt", direction = org.springframework.data.domain.Sort.Direction.DESC)
            Pageable pageable) {
        return ApiResponse.ok(walletService.adminList(userId, currencyCode, pageable));
    }

    @GetMapping("/{walletId}")
    @PreAuthorize("hasAuthority('wallets:read')")
    @Operation(summary = "Get wallet by id")
    public ApiResponse<WalletResponse> get(@PathVariable UUID walletId) {
        return ApiResponse.ok(walletService.adminGet(walletId));
    }

    @GetMapping("/{walletId}/transactions")
    @PreAuthorize("hasAuthority('wallets:read')")
    @Operation(summary = "List ledger transactions for a wallet")
    public ApiResponse<Page<LedgerTransactionResponse>> transactions(
            @PathVariable UUID walletId,
            @PageableDefault(size = 20, sort = "createdAt", direction = org.springframework.data.domain.Sort.Direction.DESC)
            Pageable pageable) {
        return ApiResponse.ok(walletService.adminTransactions(walletId, pageable));
    }
}
