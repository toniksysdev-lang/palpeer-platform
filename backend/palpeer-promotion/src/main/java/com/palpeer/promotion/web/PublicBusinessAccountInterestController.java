package com.palpeer.promotion.web;

import com.palpeer.common.api.ApiResponse;
import com.palpeer.promotion.service.BusinessAccountInterestService;
import com.palpeer.promotion.web.dto.BusinessInterestResponse;
import com.palpeer.promotion.web.dto.CreateBusinessInterestRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/public/business-account-interest")
@RequiredArgsConstructor
@Tag(name = "Public Business Waitlist")
public class PublicBusinessAccountInterestController {

    private final BusinessAccountInterestService businessAccountInterestService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Join the business-account waitlist with an email")
    public ApiResponse<BusinessInterestResponse> submit(
            @Valid @RequestBody CreateBusinessInterestRequest request) {
        return ApiResponse.ok(
                "Thanks - we will email you when business accounts are ready.",
                businessAccountInterestService.submit(request));
    }
}
