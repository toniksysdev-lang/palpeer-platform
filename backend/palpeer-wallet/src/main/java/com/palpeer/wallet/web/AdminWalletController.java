package com.palpeer.wallet.web;

import com.palpeer.auth.security.UserPrincipal;
import com.palpeer.auth.spi.AdminMfaGate;
import com.palpeer.common.api.ApiResponse;
import com.palpeer.common.exception.BusinessException;
import com.palpeer.wallet.funding.dto.FailMovementRequest;
import com.palpeer.wallet.funding.dto.FundingTransactionResponse;
import com.palpeer.wallet.service.AdminWalletMovementService;
import com.palpeer.wallet.service.WalletService;
import com.palpeer.wallet.web.dto.AdminCreateFundingRequest;
import com.palpeer.wallet.web.dto.AdminCreateWithdrawalRequest;
import com.palpeer.wallet.web.dto.AdminMoneyMovementResponse;
import com.palpeer.wallet.web.dto.AdminStepUpMfaRequest;
import com.palpeer.wallet.web.dto.LedgerTransactionResponse;
import com.palpeer.wallet.web.dto.WalletResponse;
import com.palpeer.wallet.withdrawal.dto.WithdrawalTransactionResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
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

/**
 * Admin wallet inventory (read) plus funding/withdrawal operator actions.
 */
@RestController
@RequestMapping("/api/v1/admin/wallets")
@RequiredArgsConstructor
@Tag(name = "Admin Wallets")
@SecurityRequirement(name = "bearerAuth")
@PreAuthorize("hasAuthority('ROLE_ADMIN')")
public class AdminWalletController {

    private static final String OPERATE = "hasAuthority('payments:operate')";

    private final WalletService walletService;
    private final AdminWalletMovementService movementService;
    private final ObjectProvider<AdminMfaGate> adminMfaGate;

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

    @GetMapping("/{walletId}/movements")
    @PreAuthorize("hasAuthority('wallets:read')")
    @Operation(summary = "List recent funding and withdrawal movements for a wallet")
    public ApiResponse<List<AdminMoneyMovementResponse>> movements(@PathVariable UUID walletId) {
        return ApiResponse.ok(movementService.listMovements(walletId));
    }

    @PostMapping("/{walletId}/fundings")
    @PreAuthorize(OPERATE)
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Admin: initiate funding for this wallet (idempotent)")
    public ApiResponse<FundingTransactionResponse> createFunding(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID walletId,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @Valid @RequestBody AdminCreateFundingRequest request) {
        return ApiResponse.ok(
                "Funding initiated",
                movementService.createFunding(principal.getId(), walletId, idempotencyKey, request));
    }

    @PostMapping("/{walletId}/withdrawals")
    @PreAuthorize(OPERATE)
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Admin: initiate withdrawal (HOLD) for this wallet (idempotent)")
    public ApiResponse<WithdrawalTransactionResponse> createWithdrawal(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID walletId,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @Valid @RequestBody AdminCreateWithdrawalRequest request) {
        return ApiResponse.ok(
                "Withdrawal initiated",
                movementService.createWithdrawal(principal.getId(), walletId, idempotencyKey, request));
    }

    @PostMapping("/{walletId}/fundings/{fundingId}/process")
    @PreAuthorize(OPERATE)
    @Operation(summary = "Admin: process funding to SUCCESS and CREDIT ledger")
    public ApiResponse<FundingTransactionResponse> processFunding(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID walletId,
            @PathVariable UUID fundingId,
            @Valid @RequestBody AdminStepUpMfaRequest request) {
        requireAuthenticator(principal, request.code());
        return ApiResponse.ok(movementService.processFunding(principal.getId(), walletId, fundingId));
    }

    @PostMapping("/{walletId}/fundings/{fundingId}/fail")
    @PreAuthorize(OPERATE)
    @Operation(summary = "Admin: mark funding as FAILED")
    public ApiResponse<FundingTransactionResponse> failFunding(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID walletId,
            @PathVariable UUID fundingId,
            @RequestBody(required = false) FailMovementRequest request) {
        String reason = request == null ? null : request.reason();
        return ApiResponse.ok(movementService.failFunding(principal.getId(), walletId, fundingId, reason));
    }

    @PostMapping("/{walletId}/fundings/{fundingId}/reverse")
    @PreAuthorize(OPERATE)
    @Operation(summary = "Admin: reverse successful funding (DEBIT ledger)")
    public ApiResponse<FundingTransactionResponse> reverseFunding(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID walletId,
            @PathVariable UUID fundingId,
            @Valid @RequestBody AdminStepUpMfaRequest request) {
        requireAuthenticator(principal, request.code());
        return ApiResponse.ok(movementService.reverseFunding(principal.getId(), walletId, fundingId));
    }

    @PostMapping("/{walletId}/withdrawals/{withdrawalId}/process")
    @PreAuthorize(OPERATE)
    @Operation(summary = "Admin: process withdrawal to SUCCESS (RELEASE + DEBIT)")
    public ApiResponse<WithdrawalTransactionResponse> processWithdrawal(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID walletId,
            @PathVariable UUID withdrawalId,
            @Valid @RequestBody AdminStepUpMfaRequest request) {
        requireAuthenticator(principal, request.code());
        return ApiResponse.ok(movementService.processWithdrawal(principal.getId(), walletId, withdrawalId));
    }

    @PostMapping("/{walletId}/withdrawals/{withdrawalId}/fail")
    @PreAuthorize(OPERATE)
    @Operation(summary = "Admin: fail withdrawal and RELEASE hold")
    public ApiResponse<WithdrawalTransactionResponse> failWithdrawal(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID walletId,
            @PathVariable UUID withdrawalId,
            @RequestBody(required = false) FailMovementRequest request) {
        String reason = request == null ? null : request.reason();
        return ApiResponse.ok(movementService.failWithdrawal(principal.getId(), walletId, withdrawalId, reason));
    }

    @PostMapping("/{walletId}/withdrawals/{withdrawalId}/reverse")
    @PreAuthorize(OPERATE)
    @Operation(summary = "Admin: reverse successful withdrawal (CREDIT ledger)")
    public ApiResponse<WithdrawalTransactionResponse> reverseWithdrawal(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID walletId,
            @PathVariable UUID withdrawalId,
            @Valid @RequestBody AdminStepUpMfaRequest request) {
        requireAuthenticator(principal, request.code());
        return ApiResponse.ok(movementService.reverseWithdrawal(principal.getId(), walletId, withdrawalId));
    }

    /**
     * Step-up Google Authenticator check for irreversible ledger mutations.
     * Requires enrolled MFA and a valid 6-digit TOTP (recovery codes are not accepted here).
     */
    private void requireAuthenticator(UserPrincipal principal, String code) {
        AdminMfaGate mfa = adminMfaGate.getIfAvailable();
        if (mfa == null || !mfa.isMfaRequired(principal.getId())) {
            throw new BusinessException(
                    "MFA_REQUIRED",
                    "Enable Google Authenticator MFA before processing or reversing money movements",
                    HttpStatus.FORBIDDEN);
        }
        String trimmed = code == null ? "" : code.trim();
        if (!trimmed.matches("\\d{6}") || !mfa.verifySecondFactor(principal.getId(), trimmed)) {
            throw new BusinessException(
                    "MFA_INVALID", "Invalid authenticator code", HttpStatus.UNAUTHORIZED);
        }
    }
}
