package com.palpeer.promotion.web;

import com.palpeer.common.api.ApiResponse;
import com.palpeer.promotion.service.BusinessAccountInterestService;
import com.palpeer.promotion.web.dto.BusinessInterestResponse;
import com.palpeer.promotion.web.dto.DeleteBusinessInterestsRequest;
import com.palpeer.promotion.web.dto.DeleteBusinessInterestsResponse;
import com.palpeer.promotion.web.dto.SendBusinessInterestEmailRequest;
import com.palpeer.promotion.web.dto.SendBusinessInterestEmailResponse;
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
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/business-account-interests")
@RequiredArgsConstructor
@Tag(name = "Admin Business Waitlist")
@SecurityRequirement(name = "bearerAuth")
@PreAuthorize("hasAuthority('ROLE_ADMIN')")
public class AdminBusinessAccountInterestController {

    private final BusinessAccountInterestService businessAccountInterestService;

    @GetMapping
    @PreAuthorize("hasAuthority('promotions:write')")
    @Operation(summary = "List business-account waitlist emails")
    public ApiResponse<List<BusinessInterestResponse>> list() {
        return ApiResponse.ok(businessAccountInterestService.listAll());
    }

    @PostMapping("/send-email")
    @PreAuthorize("hasAuthority('promotions:write')")
    @Operation(summary = "Email one, many, or all business waitlist addresses")
    public ApiResponse<SendBusinessInterestEmailResponse> sendEmail(
            @Valid @RequestBody SendBusinessInterestEmailRequest request) {
        return ApiResponse.ok(
                "Emails queued/sent", businessAccountInterestService.sendEmail(request));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAuthority('promotions:write')")
    @Operation(summary = "Delete one business waitlist email")
    public void delete(@PathVariable UUID id) {
        businessAccountInterestService.delete(id);
    }

    @PostMapping("/delete")
    @PreAuthorize("hasAuthority('promotions:write')")
    @Operation(summary = "Delete selected business waitlist emails")
    public ApiResponse<DeleteBusinessInterestsResponse> deleteMany(
            @Valid @RequestBody DeleteBusinessInterestsRequest request) {
        int deleted = businessAccountInterestService.deleteMany(request.ids());
        return ApiResponse.ok(
                "Waitlist emails removed", new DeleteBusinessInterestsResponse(deleted));
    }
}
