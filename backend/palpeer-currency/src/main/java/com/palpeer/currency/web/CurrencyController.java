package com.palpeer.currency.web;

import com.palpeer.common.api.ApiResponse;
import com.palpeer.currency.domain.RateChannel;
import com.palpeer.currency.service.CurrencyService;
import com.palpeer.currency.service.ExchangeRateService;
import com.palpeer.currency.web.dto.CreateCurrencyRequest;
import com.palpeer.currency.web.dto.CreateExchangeRateRequest;
import com.palpeer.currency.web.dto.CurrencyResponse;
import com.palpeer.currency.web.dto.ExchangeRateResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.time.Instant;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
@Tag(name = "Currency")
@SecurityRequirement(name = "bearerAuth")
public class CurrencyController {

    private final CurrencyService currencyService;
    private final ExchangeRateService exchangeRateService;

    @GetMapping("/currencies")
    @Operation(summary = "List currencies")
    public ApiResponse<List<CurrencyResponse>> listCurrencies() {
        return ApiResponse.ok(currencyService.list());
    }

    @GetMapping("/currencies/{code}")
    @Operation(summary = "Get currency by code")
    public ApiResponse<CurrencyResponse> getCurrency(@PathVariable String code) {
        return ApiResponse.ok(currencyService.getByCode(code));
    }

    @PostMapping("/currencies")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('currencies:write')")
    @Operation(summary = "Create currency (admin)")
    public ApiResponse<CurrencyResponse> createCurrency(@Valid @RequestBody CreateCurrencyRequest request) {
        return ApiResponse.ok("Currency created", currencyService.create(request));
    }

    @GetMapping("/exchange-rates/latest")
    @Operation(summary = "Get latest effective exchange rate for a pair")
    public ApiResponse<ExchangeRateResponse> latestRate(
            @RequestParam String base,
            @RequestParam String quote,
            @RequestParam(defaultValue = "SWAP") RateChannel channel,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant asOf) {
        return ApiResponse.ok(exchangeRateService.getLatest(base, quote, asOf, channel));
    }

    @GetMapping("/exchange-rates")
    @Operation(summary = "List exchange rate history for a pair")
    public ApiResponse<List<ExchangeRateResponse>> rateHistory(
            @RequestParam String base,
            @RequestParam String quote,
            @RequestParam(defaultValue = "SWAP") RateChannel channel) {
        return ApiResponse.ok(exchangeRateService.history(base, quote, channel));
    }

    @PostMapping("/exchange-rates")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('rates:write')")
    @Operation(summary = "Publish exchange rate (admin)")
    public ApiResponse<ExchangeRateResponse> createRate(@Valid @RequestBody CreateExchangeRateRequest request) {
        return ApiResponse.ok("Exchange rate created", exchangeRateService.create(request));
    }
}
