package com.palpeer.app.admin.search;

import com.palpeer.common.api.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
@Tag(name = "Admin Search")
@SecurityRequirement(name = "bearerAuth")
@PreAuthorize("hasAuthority('ROLE_ADMIN')")
public class AdminSearchController {

    private final AdminSearchService adminSearchService;

    @GetMapping("/search")
    @Operation(summary = "Global search (users by email/phone; entities by UUID), filtered by caller permissions")
    public ApiResponse<AdminSearchResponse> search(@RequestParam(required = false) String q) {
        return ApiResponse.ok(adminSearchService.search(q));
    }
}
