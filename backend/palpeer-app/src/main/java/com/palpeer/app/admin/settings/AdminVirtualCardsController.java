package com.palpeer.app.admin.settings;

import com.palpeer.common.api.ApiResponse;
import com.palpeer.common.settings.VirtualCardSettingService;
import com.palpeer.common.settings.VirtualCardSettingService.VirtualCardsState;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/settings/virtual-cards")
@RequiredArgsConstructor
@Tag(name = "Admin Virtual Cards Setting")
@SecurityRequirement(name = "bearerAuth")
@PreAuthorize("hasAuthority('ROLE_ADMIN')")
public class AdminVirtualCardsController {

    private final VirtualCardSettingService virtualCardSettingService;

    @GetMapping
    @PreAuthorize("hasAuthority('admin:manage')")
    @Operation(summary = "Whether virtual cards are enabled in the mobile app")
    public ApiResponse<VirtualCardsResponse> get() {
        VirtualCardsState state = virtualCardSettingService.getState();
        return ApiResponse.ok(new VirtualCardsResponse(state.enabled()));
    }

    @PutMapping
    @PreAuthorize("hasAuthority('admin:manage')")
    @Operation(summary = "Enable or disable virtual cards for the mobile app")
    public ApiResponse<VirtualCardsResponse> put(@Valid @RequestBody UpdateVirtualCardsRequest request) {
        VirtualCardsState state = virtualCardSettingService.setEnabled(Boolean.TRUE.equals(request.enabled()));
        return ApiResponse.ok(
                state.enabled() ? "Virtual cards enabled" : "Virtual cards disabled",
                new VirtualCardsResponse(state.enabled()));
    }

    public record VirtualCardsResponse(boolean enabled) {}

    public record UpdateVirtualCardsRequest(@NotNull Boolean enabled) {}
}
