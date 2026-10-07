package com.palpeer.promotion.web;

import com.palpeer.common.api.ApiResponse;
import com.palpeer.promotion.domain.BonusStatus;
import com.palpeer.promotion.domain.ReferralStatus;
import com.palpeer.promotion.service.PromotionService;
import com.palpeer.promotion.web.dto.BonusResponse;
import com.palpeer.promotion.web.dto.ReferralResponse;
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
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Admin inventory for referrals and bonuses — exposes existing domain rows only.
 * No campaign formulas or ledger settlement invented here.
 */
@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
@Tag(name = "Admin Promotions")
@SecurityRequirement(name = "bearerAuth")
@PreAuthorize("hasAuthority('ROLE_ADMIN')")
public class AdminPromotionController {

    private final PromotionService promotionService;

    @GetMapping("/referrals")
    @PreAuthorize("hasAuthority('promotions:write')")
    @Operation(summary = "List all referrals (admin inventory)")
    public ApiResponse<Page<ReferralResponse>> listReferrals(
            @RequestParam(required = false) ReferralStatus status,
            @RequestParam(required = false) String referralCode,
            @RequestParam(required = false) UUID referrerUserId,
            @RequestParam(required = false) UUID refereeUserId,
            @PageableDefault(size = 20, sort = "createdAt", direction = org.springframework.data.domain.Sort.Direction.DESC)
            Pageable pageable) {
        return ApiResponse.ok(promotionService.adminListReferrals(
                status, referralCode, referrerUserId, refereeUserId, pageable));
    }

    @GetMapping("/referrals/{id}")
    @PreAuthorize("hasAuthority('promotions:write')")
    @Operation(summary = "Get referral by id")
    public ApiResponse<ReferralResponse> getReferral(@PathVariable UUID id) {
        return ApiResponse.ok(promotionService.adminGetReferral(id));
    }

    @GetMapping("/bonuses")
    @PreAuthorize("hasAuthority('promotions:write')")
    @Operation(summary = "List all bonuses (admin inventory)")
    public ApiResponse<Page<BonusResponse>> listBonuses(
            @RequestParam(required = false) BonusStatus status,
            @RequestParam(required = false) UUID userId,
            @RequestParam(required = false) UUID referralId,
            @PageableDefault(size = 20, sort = "createdAt", direction = org.springframework.data.domain.Sort.Direction.DESC)
            Pageable pageable) {
        return ApiResponse.ok(promotionService.adminListBonuses(status, userId, referralId, pageable));
    }
}
