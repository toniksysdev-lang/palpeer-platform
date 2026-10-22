package com.palpeer.promotion.web;

import com.palpeer.auth.security.UserPrincipal;
import com.palpeer.common.api.ApiResponse;
import com.palpeer.promotion.service.PromotionService;
import com.palpeer.promotion.web.dto.ApplyReferralRequest;
import com.palpeer.promotion.web.dto.BonusCurrencySummary;
import com.palpeer.promotion.web.dto.BonusResponse;
import com.palpeer.promotion.web.dto.CreatePromotionRequest;
import com.palpeer.promotion.web.dto.PromotionResponse;
import com.palpeer.promotion.web.dto.ReferralResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/promotions")
@RequiredArgsConstructor
@Tag(name = "Promotions")
@SecurityRequirement(name = "bearerAuth")
public class PromotionController {

    private final PromotionService promotionService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('promotions:write')")
    @Operation(summary = "Create a promotion (admin)")
    public ApiResponse<PromotionResponse> create(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody CreatePromotionRequest request) {
        return ApiResponse.ok("Promotion created", promotionService.createPromotion(request));
    }

    @GetMapping("/active")
    @Operation(summary = "List currently active promotions")
    public ApiResponse<List<PromotionResponse>> listActive() {
        return ApiResponse.ok(promotionService.listActive());
    }

    @PostMapping("/referrals/my-code")
    @Operation(summary = "Get or create my referral code")
    public ApiResponse<ReferralResponse> myCode(@AuthenticationPrincipal UserPrincipal principal) {
        return ApiResponse.ok(promotionService.myReferralCode(principal.getId()));
    }

    @GetMapping("/referrals/mine")
    @Operation(summary = "List referrals I created")
    public ApiResponse<List<ReferralResponse>> myReferrals(@AuthenticationPrincipal UserPrincipal principal) {
        return ApiResponse.ok(promotionService.myReferrals(principal.getId()));
    }

    @PostMapping("/referrals/apply")
    @Operation(summary = "Apply a referral code as the referee")
    public ApiResponse<ReferralResponse> apply(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody ApplyReferralRequest request) {
        return ApiResponse.ok("Referral applied", promotionService.applyReferral(principal.getId(), request));
    }

    @GetMapping("/bonuses/mine")
    @Operation(summary = "List my bonuses")
    public ApiResponse<Page<BonusResponse>> myBonuses(
            @AuthenticationPrincipal UserPrincipal principal,
            @PageableDefault(size = 20) Pageable pageable) {
        return ApiResponse.ok(promotionService.myBonuses(principal.getId(), pageable));
    }

    @GetMapping("/bonuses/mine/summary")
    @Operation(summary = "Per-currency bonus totals (total / unused / used)")
    public ApiResponse<List<BonusCurrencySummary>> myBonusSummary(
            @AuthenticationPrincipal UserPrincipal principal) {
        return ApiResponse.ok(promotionService.myBonusSummary(principal.getId()));
    }
}
