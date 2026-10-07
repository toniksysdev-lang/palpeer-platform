package com.palpeer.profile.web;

import com.palpeer.auth.security.UserPrincipal;
import com.palpeer.common.api.ApiResponse;
import com.palpeer.profile.service.ProfileService;
import com.palpeer.profile.web.dto.CreateProfileRequest;
import com.palpeer.profile.web.dto.ProfileResponse;
import com.palpeer.profile.web.dto.UpdateProfileRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/profiles")
@RequiredArgsConstructor
@Tag(name = "Profile")
@SecurityRequirement(name = "bearerAuth")
public class ProfileController {

    private final ProfileService profileService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Create profile for the authenticated user")
    public ApiResponse<ProfileResponse> create(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody CreateProfileRequest request) {
        return ApiResponse.ok("Profile created", profileService.create(principal.getId(), request));
    }

    @GetMapping("/me")
    @Operation(summary = "Get authenticated user profile")
    public ApiResponse<ProfileResponse> me(@AuthenticationPrincipal UserPrincipal principal) {
        return ApiResponse.ok(profileService.getByUserId(principal.getId()));
    }

    @PutMapping("/me")
    @Operation(summary = "Update authenticated user personal information")
    public ApiResponse<ProfileResponse> update(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody UpdateProfileRequest request) {
        return ApiResponse.ok("Profile updated", profileService.update(principal.getId(), request));
    }
}
