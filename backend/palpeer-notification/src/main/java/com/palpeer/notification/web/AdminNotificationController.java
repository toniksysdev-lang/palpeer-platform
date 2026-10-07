package com.palpeer.notification.web;

import com.palpeer.common.api.ApiResponse;
import com.palpeer.notification.service.NotificationService;
import com.palpeer.notification.web.dto.NotificationResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Admin inventory of notifications across users — read-only.
 * Does not invent broadcast/create (P12-06).
 */
@RestController
@RequestMapping("/api/v1/admin/notifications")
@RequiredArgsConstructor
@Tag(name = "Admin Notifications")
@SecurityRequirement(name = "bearerAuth")
@PreAuthorize("hasAuthority('ROLE_ADMIN')")
public class AdminNotificationController {

    private final NotificationService notificationService;

    @GetMapping
    @PreAuthorize("hasAuthority('notifications:read')")
    @Operation(summary = "List recent notifications across users (admin inventory)")
    public ApiResponse<Page<NotificationResponse>> list(
            @PageableDefault(size = 20, sort = "createdAt", direction = org.springframework.data.domain.Sort.Direction.DESC)
            Pageable pageable) {
        return ApiResponse.ok(notificationService.adminList(pageable));
    }
}
