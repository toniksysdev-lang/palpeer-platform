package com.palpeer.wallet.web;

import com.palpeer.common.api.ApiResponse;
import com.palpeer.wallet.domain.PlatformFeeSourceType;
import com.palpeer.wallet.service.PlatformFeeRevenueService;
import com.palpeer.wallet.service.PlatformFeeExcel;
import com.palpeer.wallet.web.dto.PlatformFeeRevenueResponse;
import com.palpeer.wallet.web.dto.PlatformFeeSummaryResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/platform-fees")
@RequiredArgsConstructor
@Tag(name = "Admin Platform Fees")
@SecurityRequirement(name = "bearerAuth")
@PreAuthorize("hasAuthority('ROLE_ADMIN')")
public class AdminPlatformFeeController {

    private final PlatformFeeRevenueService platformFeeRevenueService;

    @GetMapping
    @PreAuthorize("hasAnyAuthority('reports:read', 'fees:read')")
    @Operation(summary = "Search platform fee revenue (P2P and InstantEX)")
    public ApiResponse<Page<PlatformFeeRevenueResponse>> list(
            @RequestParam(required = false) PlatformFeeSourceType sourceType,
            @RequestParam(required = false) String currency,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to,
            @PageableDefault(size = 20) Pageable pageable) {
        return ApiResponse.ok(platformFeeRevenueService.search(sourceType, currency, q, from, to, pageable));
    }

    @GetMapping("/summary")
    @PreAuthorize("hasAnyAuthority('reports:read', 'fees:read')")
    @Operation(summary = "Platform fee revenue totals (Grand / P2P / InstantEX)")
    public ApiResponse<PlatformFeeSummaryResponse> summary(
            @RequestParam(required = false) String currency,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to) {
        return ApiResponse.ok(platformFeeRevenueService.summarize(currency, q, from, to));
    }

    @GetMapping("/export")
    @PreAuthorize("hasAnyAuthority('reports:read', 'fees:read')")
    @Operation(summary = "Export platform fee revenue to Excel (.xls)")
    public ResponseEntity<byte[]> export(
            @RequestParam(required = false) PlatformFeeSourceType sourceType,
            @RequestParam(required = false) String currency,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to) {
        List<PlatformFeeRevenueResponse> rows =
                platformFeeRevenueService.export(sourceType, currency, q, from, to);
        return PlatformFeeExcel.toResponse(rows);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyAuthority('reports:read', 'fees:read')")
    @Operation(summary = "Platform fee revenue detail")
    public ApiResponse<PlatformFeeRevenueResponse> get(@PathVariable UUID id) {
        return ApiResponse.ok(platformFeeRevenueService.getById(id));
    }
}
