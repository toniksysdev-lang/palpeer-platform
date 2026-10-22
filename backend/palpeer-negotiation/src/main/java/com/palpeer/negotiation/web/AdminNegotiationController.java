package com.palpeer.negotiation.web;

import com.palpeer.common.api.ApiResponse;
import com.palpeer.negotiation.domain.NegotiationStatus;
import com.palpeer.negotiation.service.NegotiationService;
import com.palpeer.negotiation.web.dto.NegotiationResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Admin inventory and interventions for negotiations (no participant checks).
 */
@RestController
@RequestMapping("/api/v1/admin/negotiations")
@RequiredArgsConstructor
@Tag(name = "Admin Negotiations")
@SecurityRequirement(name = "bearerAuth")
@PreAuthorize("hasAuthority('ROLE_ADMIN')")
public class AdminNegotiationController {

    private final NegotiationService negotiationService;

    @GetMapping
    @PreAuthorize("hasAuthority('negotiations:read')")
    @Operation(summary = "List all negotiations (admin inventory)")
    public ApiResponse<Page<NegotiationResponse>> list(
            @RequestParam(required = false) UUID userId,
            @RequestParam(required = false) NegotiationStatus status,
            @PageableDefault(size = 20, sort = "createdAt", direction = org.springframework.data.domain.Sort.Direction.DESC)
            Pageable pageable) {
        return ApiResponse.ok(negotiationService.adminList(userId, status, pageable));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('negotiations:read')")
    @Operation(summary = "Get negotiation by id")
    public ApiResponse<NegotiationResponse> get(@PathVariable UUID id) {
        return ApiResponse.ok(negotiationService.adminGet(id));
    }

    @PostMapping("/{id}/cancel")
    @PreAuthorize("hasAuthority('negotiations:write')")
    @Operation(summary = "Force-cancel an OPEN negotiation")
    public ApiResponse<NegotiationResponse> cancel(@PathVariable UUID id) {
        return ApiResponse.ok("Negotiation cancelled", negotiationService.adminCancel(id));
    }

    @PostMapping("/{id}/accept")
    @PreAuthorize("hasAuthority('negotiations:write')")
    @Operation(summary = "Force-accept the current pending offer and create the P2P order")
    public ApiResponse<NegotiationResponse> accept(@PathVariable UUID id) {
        return ApiResponse.ok("Negotiation accepted", negotiationService.adminAccept(id));
    }
}
