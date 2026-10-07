package com.palpeer.wallet.web;

import com.palpeer.auth.security.UserPrincipal;
import com.palpeer.common.api.ApiResponse;
import com.palpeer.wallet.service.WalletService;
import com.palpeer.wallet.web.dto.CreateWalletRequest;
import com.palpeer.wallet.web.dto.LedgerTransactionResponse;
import com.palpeer.wallet.web.dto.WalletResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/wallets")
@RequiredArgsConstructor
@Tag(name = "Wallet")
@SecurityRequirement(name = "bearerAuth")
public class WalletController {

    private final WalletService walletService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Create wallet for a currency")
    public ApiResponse<WalletResponse> create(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody CreateWalletRequest request) {
        return ApiResponse.ok("Wallet created", walletService.create(principal.getId(), request));
    }

    @GetMapping
    @Operation(summary = "List wallets for authenticated user")
    public ApiResponse<List<WalletResponse>> list(@AuthenticationPrincipal UserPrincipal principal) {
        return ApiResponse.ok(walletService.list(principal.getId()));
    }

    @GetMapping("/{walletId}")
    @Operation(summary = "Get wallet by id")
    public ApiResponse<WalletResponse> get(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID walletId) {
        return ApiResponse.ok(walletService.get(principal.getId(), walletId));
    }

    @GetMapping("/{walletId}/transactions")
    @Operation(summary = "List ledger transactions for a wallet")
    public ApiResponse<Page<LedgerTransactionResponse>> transactions(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID walletId,
            @PageableDefault(size = 20) Pageable pageable) {
        return ApiResponse.ok(walletService.transactions(principal.getId(), walletId, pageable));
    }
}
