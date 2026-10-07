package com.palpeer.notification.web;

import com.palpeer.auth.security.UserPrincipal;
import com.palpeer.common.api.ApiResponse;
import com.palpeer.notification.domain.NotificationStatus;
import com.palpeer.notification.service.DeviceTokenService;
import com.palpeer.notification.service.NotificationService;
import com.palpeer.notification.web.dto.DeviceTokenResponse;
import com.palpeer.notification.web.dto.NotificationResponse;
import com.palpeer.notification.web.dto.RegisterDeviceTokenRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/notifications")
@RequiredArgsConstructor
@Tag(name = "Notifications")
@SecurityRequirement(name = "bearerAuth")
public class NotificationController {

    private final DeviceTokenService deviceTokenService;
    private final NotificationService notificationService;

    @PostMapping("/device-tokens")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Register or refresh a push device token")
    public ApiResponse<DeviceTokenResponse> registerToken(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody RegisterDeviceTokenRequest request) {
        return ApiResponse.ok("Device token registered", deviceTokenService.register(principal.getId(), request));
    }

    @GetMapping("/device-tokens")
    @Operation(summary = "List my device tokens")
    public ApiResponse<List<DeviceTokenResponse>> listTokens(@AuthenticationPrincipal UserPrincipal principal) {
        return ApiResponse.ok(deviceTokenService.list(principal.getId()));
    }

    @PostMapping("/device-tokens/{tokenId}/disable")
    @Operation(summary = "Disable a device token")
    public ApiResponse<DeviceTokenResponse> disableToken(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID tokenId) {
        return ApiResponse.ok(deviceTokenService.disable(principal.getId(), tokenId));
    }

    @DeleteMapping("/device-tokens/{tokenId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Delete a device token")
    public void deleteToken(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID tokenId) {
        deviceTokenService.delete(principal.getId(), tokenId);
    }

    @GetMapping
    @Operation(summary = "List my notifications")
    public ApiResponse<Page<NotificationResponse>> list(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam(required = false) NotificationStatus status,
            @PageableDefault(size = 20) Pageable pageable) {
        return ApiResponse.ok(notificationService.list(principal.getId(), status, pageable));
    }

    @GetMapping("/unread-count")
    @Operation(summary = "Count unread (PENDING + SENT) notifications")
    public ApiResponse<Map<String, Long>> unreadCount(@AuthenticationPrincipal UserPrincipal principal) {
        return ApiResponse.ok(Map.of("count", notificationService.unreadCount(principal.getId())));
    }

    @GetMapping("/{notificationId}")
    @Operation(summary = "Get notification details")
    public ApiResponse<NotificationResponse> get(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID notificationId) {
        return ApiResponse.ok(notificationService.get(principal.getId(), notificationId));
    }

    @PostMapping("/{notificationId}/read")
    @Operation(summary = "Mark notification as read")
    public ApiResponse<NotificationResponse> markRead(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID notificationId) {
        return ApiResponse.ok(notificationService.markRead(principal.getId(), notificationId));
    }
}
