package com.palpeer.exchange.web;

import com.palpeer.common.api.ApiResponse;
import com.palpeer.exchange.service.InstantExFeeTierService;
import com.palpeer.exchange.web.dto.InstantExFeeTierResponse;
import com.palpeer.exchange.web.dto.UpsertInstantExFeeTierRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/fees/instantex")
@RequiredArgsConstructor
@Tag(name = "Admin InstantEX Fees")
@SecurityRequirement(name = "bearerAuth")
@PreAuthorize("hasAuthority('ROLE_ADMIN')")
public class AdminInstantExFeeController {

    private final InstantExFeeTierService instantExFeeTierService;

    @GetMapping
    @PreAuthorize("hasAuthority('fees:read')")
    @Operation(summary = "List InstantEX fee tiers")
    public ApiResponse<List<InstantExFeeTierResponse>> list() {
        return ApiResponse.ok(instantExFeeTierService.listAll());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('fees:write')")
    @Operation(summary = "Create an InstantEX fee tier")
    public ApiResponse<InstantExFeeTierResponse> create(@Valid @RequestBody UpsertInstantExFeeTierRequest request) {
        return ApiResponse.ok("Fee tier created", instantExFeeTierService.create(request));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('fees:write')")
    @Operation(summary = "Update an InstantEX fee tier")
    public ApiResponse<InstantExFeeTierResponse> update(
            @PathVariable UUID id, @Valid @RequestBody UpsertInstantExFeeTierRequest request) {
        return ApiResponse.ok("Fee tier updated", instantExFeeTierService.update(id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('fees:write')")
    @Operation(summary = "Delete an InstantEX fee tier")
    public ApiResponse<Void> delete(@PathVariable UUID id) {
        instantExFeeTierService.delete(id);
        return ApiResponse.ok("Fee tier deleted", null);
    }
}
