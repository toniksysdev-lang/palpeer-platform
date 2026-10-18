package com.palpeer.promotion.web;

import com.palpeer.common.api.ApiResponse;
import com.palpeer.promotion.service.MarketingAdvertService;
import com.palpeer.promotion.web.dto.CreateMarketingAdvertRequest;
import com.palpeer.promotion.web.dto.MarketingAdvertResponse;
import com.palpeer.promotion.web.dto.UpdateMarketingAdvertRequest;
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
@RequestMapping("/api/v1/admin/marketing-adverts")
@RequiredArgsConstructor
@Tag(name = "Admin Marketing")
@SecurityRequirement(name = "bearerAuth")
@PreAuthorize("hasAuthority('ROLE_ADMIN')")
public class AdminMarketingAdvertController {

    private final MarketingAdvertService marketingAdvertService;

    @GetMapping
    @PreAuthorize("hasAuthority('promotions:write')")
    @Operation(summary = "List all marketing adverts")
    public ApiResponse<List<MarketingAdvertResponse>> list() {
        return ApiResponse.ok(marketingAdvertService.listAll());
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('promotions:write')")
    @Operation(summary = "Get a marketing advert")
    public ApiResponse<MarketingAdvertResponse> get(@PathVariable UUID id) {
        return ApiResponse.ok(marketingAdvertService.get(id));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('promotions:write')")
    @Operation(summary = "Create a marketing advert")
    public ApiResponse<MarketingAdvertResponse> create(@Valid @RequestBody CreateMarketingAdvertRequest request) {
        return ApiResponse.ok("Advert created", marketingAdvertService.create(request));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('promotions:write')")
    @Operation(summary = "Update a marketing advert")
    public ApiResponse<MarketingAdvertResponse> update(
            @PathVariable UUID id, @Valid @RequestBody UpdateMarketingAdvertRequest request) {
        return ApiResponse.ok("Advert updated", marketingAdvertService.update(id, request));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAuthority('promotions:write')")
    @Operation(summary = "Delete a marketing advert")
    public void delete(@PathVariable UUID id) {
        marketingAdvertService.delete(id);
    }
}
