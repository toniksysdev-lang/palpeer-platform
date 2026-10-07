package com.palpeer.wallet.funding;

import com.palpeer.auth.security.UserPrincipal;
import com.palpeer.common.api.ApiResponse;
import com.palpeer.wallet.funding.dto.CreateFundingRequest;
import com.palpeer.wallet.funding.dto.FailMovementRequest;
import com.palpeer.wallet.funding.dto.FundingTransactionResponse;
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
@RequestMapping("/api/v1/funding")
@RequiredArgsConstructor
@Tag(name = "Funding")
@SecurityRequirement(name = "bearerAuth")
public class FundingController {

    private static final String OPERATOR = "hasAuthority('ROLE_ADMIN') and hasAuthority('payments:operate')";

    private final FundingService fundingService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Initiate funding (idempotent)")
    public ApiResponse<FundingTransactionResponse> initiate(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @Valid @RequestBody CreateFundingRequest request) {
        return ApiResponse.ok("Funding initiated", fundingService.initiate(principal.getId(), idempotencyKey, request));
    }

    @GetMapping("/{fundingId}")
    @Operation(summary = "Get funding transaction")
    public ApiResponse<FundingTransactionResponse> get(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID fundingId) {
        return ApiResponse.ok(fundingService.get(principal.getId(), fundingId));
    }

    @PostMapping("/{fundingId}/process")
    @PreAuthorize(OPERATOR)
    @Operation(summary = "Operator: process funding to SUCCESS and CREDIT ledger")
    public ApiResponse<FundingTransactionResponse> process(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID fundingId) {
        return ApiResponse.ok(fundingService.operatorProcess(principal.getId(), fundingId));
    }

    @PostMapping("/{fundingId}/fail")
    @PreAuthorize(OPERATOR)
    @Operation(summary = "Operator: mark funding as FAILED")
    public ApiResponse<FundingTransactionResponse> fail(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID fundingId,
            @RequestBody(required = false) FailMovementRequest request) {
        String reason = request == null ? null : request.reason();
        return ApiResponse.ok(fundingService.operatorFail(principal.getId(), fundingId, reason));
    }

    @PostMapping("/{fundingId}/reverse")
    @PreAuthorize(OPERATOR)
    @Operation(summary = "Operator: reverse successful funding (DEBIT ledger)")
    public ApiResponse<FundingTransactionResponse> reverse(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID fundingId) {
        return ApiResponse.ok(fundingService.operatorReverse(principal.getId(), fundingId));
    }
}
