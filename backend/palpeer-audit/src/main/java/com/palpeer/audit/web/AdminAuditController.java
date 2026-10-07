package com.palpeer.audit.web;

import com.palpeer.audit.service.AuditQueryService;
import com.palpeer.audit.web.dto.AuditLogResponse;
import com.palpeer.common.api.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.Instant;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/audit-logs")
@RequiredArgsConstructor
@Tag(name = "Admin Audit")
@SecurityRequirement(name = "bearerAuth")
@PreAuthorize("hasAuthority('ROLE_ADMIN')")
public class AdminAuditController {

    private final AuditQueryService auditQueryService;

    @GetMapping
    @PreAuthorize("hasAuthority('audit:read')")
    @Operation(summary = "Search audit logs")
    public ApiResponse<Page<AuditLogResponse>> search(
            @RequestParam(required = false) String userRef,
            @RequestParam(required = false) String action,
            @RequestParam(required = false) String entity,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to,
            @PageableDefault(size = 50) Pageable pageable) {
        return ApiResponse.ok(auditQueryService.search(userRef, action, entity, from, to, pageable));
    }
}
