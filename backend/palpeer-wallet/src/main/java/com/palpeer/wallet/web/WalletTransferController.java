package com.palpeer.wallet.web;

import com.palpeer.auth.security.UserPrincipal;
import com.palpeer.common.api.ApiResponse;
import com.palpeer.wallet.transfer.WalletTransferService;
import com.palpeer.wallet.transfer.dto.CreateWalletTransferRequest;
import com.palpeer.wallet.transfer.dto.TransferRecipientResponse;
import com.palpeer.wallet.transfer.dto.WalletTransferResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/transfers")
@RequiredArgsConstructor
@Tag(name = "Transfer")
@SecurityRequirement(name = "bearerAuth")
public class WalletTransferController {

    private final WalletTransferService walletTransferService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Transfer funds from your wallet to another user's wallet (same currency)")
    public ApiResponse<WalletTransferResponse> transfer(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @Valid @RequestBody CreateWalletTransferRequest request) {
        return ApiResponse.ok(
                "Transfer completed",
                walletTransferService.transfer(principal.getId(), idempotencyKey, request));
    }

    @GetMapping("/recipient")
    @Operation(summary = "Confirm a transfer recipient by email or phone (returns full name)")
    public ApiResponse<TransferRecipientResponse> lookupRecipient(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam("q") String q,
            @RequestParam(value = "currencyCode", required = false) String currencyCode) {
        return ApiResponse.ok(
                walletTransferService.lookupRecipient(principal.getId(), q, currencyCode));
    }

    @GetMapping("/{transferId}")
    @Operation(summary = "Get a transfer you sent or received")
    public ApiResponse<WalletTransferResponse> get(
            @AuthenticationPrincipal UserPrincipal principal, @PathVariable UUID transferId) {
        return ApiResponse.ok(walletTransferService.get(principal.getId(), transferId));
    }
}
