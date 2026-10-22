package com.palpeer.notification.web;

import com.palpeer.common.api.ApiResponse;
import com.palpeer.notification.push.FcmCredentialsPresentCondition;
import com.palpeer.notification.push.FcmProperties;
import com.palpeer.notification.service.BroadcastPushStats;
import com.palpeer.notification.service.NotificationService;
import com.palpeer.notification.web.dto.AdminBroadcastPushRequest;
import com.palpeer.notification.web.dto.AdminBroadcastPushResponse;
import com.palpeer.notification.web.dto.NotificationResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Admin notification inventory and broadcast push.
 */
@RestController
@RequestMapping("/api/v1/admin/notifications")
@RequiredArgsConstructor
@Tag(name = "Admin Notifications")
@SecurityRequirement(name = "bearerAuth")
@PreAuthorize("hasAuthority('ROLE_ADMIN')")
public class AdminNotificationController {

    private final NotificationService notificationService;
    private final FcmProperties fcmProperties;

    @GetMapping
    @PreAuthorize("hasAuthority('notifications:read')")
    @Operation(summary = "List recent notifications across users (admin inventory)")
    public ApiResponse<Page<NotificationResponse>> list(
            @PageableDefault(size = 20, sort = "createdAt", direction = org.springframework.data.domain.Sort.Direction.DESC)
            Pageable pageable) {
        return ApiResponse.ok(notificationService.adminList(pageable));
    }

    @PostMapping("/broadcast")
    @PreAuthorize("hasAuthority('notifications:write')")
    @Operation(summary = "Send a push notification to all app users")
    public ApiResponse<AdminBroadcastPushResponse> broadcast(@Valid @RequestBody AdminBroadcastPushRequest request) {
        String category = request.category() == null || request.category().isBlank()
                ? "ADMIN"
                : request.category().trim();
        BroadcastPushStats stats = notificationService.broadcastPush(
                null,
                request.title().trim(),
                request.body().trim(),
                category,
                "ADMIN_BROADCAST",
                null);
        boolean fcmEnabled = fcmProperties.isEnabled() && FcmCredentialsPresentCondition.credentialsPresent(fcmProperties);
        return ApiResponse.ok(new AdminBroadcastPushResponse(
                stats.recipientCount(),
                request.title().trim(),
                stats.devicePushCount(),
                stats.failedCount(),
                fcmEnabled));
    }
}
