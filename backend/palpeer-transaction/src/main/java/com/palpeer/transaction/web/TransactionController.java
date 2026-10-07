package com.palpeer.transaction.web;

import com.palpeer.auth.security.UserPrincipal;
import com.palpeer.common.api.ApiResponse;
import com.palpeer.transaction.domain.TransactionActivityType;
import com.palpeer.transaction.service.TransactionQueryService;
import com.palpeer.transaction.web.dto.TransactionItemResponse;
import com.palpeer.transaction.web.dto.TransactionPageResponse;
import com.palpeer.transaction.web.dto.TransactionSummaryResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/transactions")
@RequiredArgsConstructor
@Tag(name = "Transactions")
@SecurityRequirement(name = "bearerAuth")
public class TransactionController {

    private final TransactionQueryService transactionQueryService;

    @GetMapping("/recent")
    @Operation(summary = "Recent transactions across funding, withdrawal, and exchange")
    public ApiResponse<List<TransactionItemResponse>> recent(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam(defaultValue = "20") int limit) {
        return ApiResponse.ok(transactionQueryService.recent(principal.getId(), limit));
    }

    @GetMapping("/{type}/{id}")
    @Operation(summary = "Transaction details by type and id")
    public ApiResponse<TransactionItemResponse> details(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable TransactionActivityType type,
            @PathVariable UUID id) {
        return ApiResponse.ok(transactionQueryService.details(principal.getId(), type, id));
    }

    @GetMapping("/history")
    @Operation(summary = "Paginated transaction history")
    public ApiResponse<TransactionPageResponse> history(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam(required = false) TransactionActivityType type,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.ok(transactionQueryService.history(principal.getId(), type, from, to, page, size));
    }

    @GetMapping("/summary")
    @Operation(summary = "Transaction summary aggregates for a period")
    public ApiResponse<TransactionSummaryResponse> summary(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to) {
        return ApiResponse.ok(transactionQueryService.summary(principal.getId(), from, to));
    }
}
