package com.palpeer.exchange.web;

import com.palpeer.auth.security.UserPrincipal;
import com.palpeer.common.api.ApiResponse;
import com.palpeer.exchange.service.ExchangeExecutionService;
import com.palpeer.exchange.service.ExchangeQuoteService;
import com.palpeer.exchange.web.dto.ExchangeCalculateRequest;
import com.palpeer.exchange.web.dto.ExchangeCalculationResponse;
import com.palpeer.exchange.web.dto.ExchangeQuoteResponse;
import com.palpeer.exchange.web.dto.ExchangeTransactionResponse;
import com.palpeer.exchange.web.dto.ExecuteExchangeRequest;
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
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/exchange")
@RequiredArgsConstructor
@Tag(name = "Instant Exchange")
@SecurityRequirement(name = "bearerAuth")
public class ExchangeController {

    private final ExchangeQuoteService exchangeQuoteService;
    private final ExchangeExecutionService exchangeExecutionService;

    @PostMapping("/calculate")
    @Operation(summary = "Calculate exchange amounts (no quote persisted)")
    public ApiResponse<ExchangeCalculationResponse> calculate(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody ExchangeCalculateRequest request) {
        return ApiResponse.ok(exchangeQuoteService.calculate(principal.getId(), request));
    }

    @PostMapping("/preview")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Preview exchange and create a time-bound quote")
    public ApiResponse<ExchangeQuoteResponse> preview(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody ExchangeCalculateRequest request) {
        return ApiResponse.ok("Quote created", exchangeQuoteService.preview(principal.getId(), request));
    }

    @PostMapping("/execute")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Execute a quote (ledger DEBIT source + CREDIT target)")
    public ApiResponse<ExchangeTransactionResponse> execute(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @Valid @RequestBody ExecuteExchangeRequest request) {
        return ApiResponse.ok(
                "Exchange executed",
                exchangeExecutionService.execute(principal.getId(), idempotencyKey, request));
    }

    @GetMapping("/transactions/{exchangeId}")
    @Operation(summary = "Get exchange transaction")
    public ApiResponse<ExchangeTransactionResponse> get(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID exchangeId) {
        return ApiResponse.ok(exchangeExecutionService.get(principal.getId(), exchangeId));
    }
}
