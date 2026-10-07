package com.palpeer.wallet.withdrawal;

import com.palpeer.auth.security.UserPrincipal;
import com.palpeer.common.api.ApiResponse;
import com.palpeer.wallet.funding.dto.FailMovementRequest;
import com.palpeer.wallet.withdrawal.dto.CreateWithdrawalRequest;
import com.palpeer.wallet.withdrawal.dto.WithdrawalTransactionResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/withdrawals")
@RequiredArgsConstructor
@Tag(name = "Withdrawal")
@SecurityRequirement(name = "bearerAuth")
public class WithdrawalController {

    private static final String OPERATOR = "hasAuthority('ROLE_ADMIN') and hasAuthority('payments:operate')";

    private final WithdrawalService withdrawalService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Initiate withdrawal with HOLD (idempotent)")
    public ApiResponse<WithdrawalTransactionResponse> initiate(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @Valid @RequestBody CreateWithdrawalRequest request) {
        return ApiResponse.ok(
                "Withdrawal initiated",
                withdrawalService.initiate(principal.getId(), idempotencyKey, request));
    }

    @GetMapping("/{withdrawalId}")
    @Operation(summary = "Get withdrawal transaction")
    public ApiResponse<WithdrawalTransactionResponse> get(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID withdrawalId) {
        return ApiResponse.ok(withdrawalService.get(principal.getId(), withdrawalId));
    }

    @PostMapping("/{withdrawalId}/process")
    @PreAuthorize(OPERATOR)
    @Operation(summary = "Operator: process withdrawal to SUCCESS (RELEASE + DEBIT)")
    public ApiResponse<WithdrawalTransactionResponse> process(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID withdrawalId) {
        return ApiResponse.ok(withdrawalService.operatorProcess(principal.getId(), withdrawalId));
    }

    @PostMapping("/{withdrawalId}/fail")
    @PreAuthorize(OPERATOR)
    @Operation(summary = "Operator: fail withdrawal and RELEASE hold")
    public ApiResponse<WithdrawalTransactionResponse> fail(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID withdrawalId,
            @RequestBody(required = false) FailMovementRequest request) {
        String reason = request == null ? null : request.reason();
        return ApiResponse.ok(withdrawalService.operatorFail(principal.getId(), withdrawalId, reason));
    }

    @PostMapping("/{withdrawalId}/reverse")
    @PreAuthorize(OPERATOR)
    @Operation(summary = "Operator: reverse successful withdrawal (CREDIT ledger)")
    public ApiResponse<WithdrawalTransactionResponse> reverse(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID withdrawalId) {
        return ApiResponse.ok(withdrawalService.operatorReverse(principal.getId(), withdrawalId));
    }
}
