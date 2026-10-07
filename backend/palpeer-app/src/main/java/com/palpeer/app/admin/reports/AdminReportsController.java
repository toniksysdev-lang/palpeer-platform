package com.palpeer.app.admin.reports;

import com.palpeer.common.api.ApiResponse;
import com.palpeer.common.csv.CsvWriter;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.Instant;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/reports")
@RequiredArgsConstructor
@Tag(name = "Admin Reports")
@SecurityRequirement(name = "bearerAuth")
@PreAuthorize("hasAuthority('ROLE_ADMIN')")
public class AdminReportsController {

    private final AdminReportsService adminReportsService;
    private final AdminReportExportService adminReportExportService;

    @GetMapping("/summary")
    @PreAuthorize("hasAuthority('reports:read')")
    @Operation(summary = "Platform aggregates (all-time inventory counts; transactions within from/to, default 30 days)")
    public ApiResponse<AdminReportSummaryResponse> summary(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to) {
        return ApiResponse.ok(adminReportsService.summary(from, to));
    }

    @GetMapping("/export/{dataset}")
    @PreAuthorize("hasAuthority('reports:read')")
    @Operation(summary = "Export a dataset as CSV (max 5,000 rows; audit-logs also needs audit:read)")
    public ResponseEntity<byte[]> export(
            @PathVariable String dataset,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to) {
        return adminReportExportService.export(dataset, from, to).toResponse(CsvWriter.filename(dataset));
    }
}
