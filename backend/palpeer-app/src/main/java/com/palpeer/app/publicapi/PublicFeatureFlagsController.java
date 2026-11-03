package com.palpeer.app.publicapi;

import com.palpeer.common.api.ApiResponse;
import com.palpeer.common.settings.VirtualCardSettingService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/public/feature-flags")
@RequiredArgsConstructor
@Tag(name = "Public Feature Flags")
public class PublicFeatureFlagsController {

    private final VirtualCardSettingService virtualCardSettingService;

    @GetMapping
    @Operation(summary = "Client feature flags (virtual cards, etc.)")
    public ApiResponse<FeatureFlagsResponse> get() {
        return ApiResponse.ok(new FeatureFlagsResponse(virtualCardSettingService.isEnabled()));
    }

    public record FeatureFlagsResponse(boolean virtualCardsEnabled) {}
}
