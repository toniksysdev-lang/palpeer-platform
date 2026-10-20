package com.palpeer.app.admin.settings;

import com.palpeer.common.api.ApiResponse;
import com.palpeer.common.settings.RegistrationCountryService;
import com.palpeer.common.settings.RegistrationCountryService.RegistrationCountriesState;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/settings/registration-countries")
@RequiredArgsConstructor
@Tag(name = "Admin Registration Countries")
@SecurityRequirement(name = "bearerAuth")
@PreAuthorize("hasAuthority('ROLE_ADMIN')")
public class AdminRegistrationCountriesController {

    private final RegistrationCountryService registrationCountryService;

    @GetMapping
    @PreAuthorize("hasAuthority('admin:manage')")
    @Operation(summary = "List countries configured for mobile app registration")
    public ApiResponse<RegistrationCountriesResponse> get() {
        RegistrationCountriesState state = registrationCountryService.getState();
        return ApiResponse.ok(toResponse(state));
    }

    @PutMapping
    @PreAuthorize("hasAuthority('admin:manage')")
    @Operation(summary = "Update configured/enabled countries for mobile app registration")
    public ApiResponse<RegistrationCountriesResponse> put(
            @Valid @RequestBody UpdateRegistrationCountriesRequest request) {
        List<String> configured =
                request.configuredIso2() != null && !request.configuredIso2().isEmpty()
                        ? request.configuredIso2()
                        : request.enabledIso2();
        RegistrationCountriesState state =
                registrationCountryService.replaceState(configured, request.enabledIso2());
        return ApiResponse.ok("Registration countries updated", toResponse(state));
    }

    private static RegistrationCountriesResponse toResponse(RegistrationCountriesState state) {
        return new RegistrationCountriesResponse(
                state.configuredIso2(),
                state.configuredIso2(),
                state.enabledIso2());
    }

    /**
     * {@code supportedIso2} is kept for older admin clients (same as configured).
     */
    public record RegistrationCountriesResponse(
            List<String> supportedIso2, List<String> configuredIso2, List<String> enabledIso2) {}

    public record UpdateRegistrationCountriesRequest(
            List<String> configuredIso2, @NotEmpty List<String> enabledIso2) {}
}
