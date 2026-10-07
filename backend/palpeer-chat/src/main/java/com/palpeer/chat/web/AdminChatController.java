package com.palpeer.chat.web;

import com.palpeer.chat.service.ChatService;
import com.palpeer.chat.web.dto.ChatMessageResponse;
import com.palpeer.chat.web.dto.ChatRoomResponse;
import com.palpeer.common.api.ApiResponse;
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
 * Admin inventory for chat rooms/messages — read-only, no participant checks.
 * Does not invent STOMP admin monitoring (WS contract remains separate).
 */
@RestController
@RequestMapping("/api/v1/admin/chat/rooms")
@RequiredArgsConstructor
@Tag(name = "Admin Chat")
@SecurityRequirement(name = "bearerAuth")
@PreAuthorize("hasAuthority('ROLE_ADMIN')")
public class AdminChatController {

    private final ChatService chatService;

    @GetMapping
    @PreAuthorize("hasAuthority('chat:read')")
    @Operation(summary = "List all chat rooms (admin inventory)")
    public ApiResponse<Page<ChatRoomResponse>> listRooms(
            @RequestParam(required = false) UUID userId,
            @PageableDefault(size = 20, sort = "createdAt", direction = org.springframework.data.domain.Sort.Direction.DESC)
            Pageable pageable) {
        return ApiResponse.ok(chatService.adminListRooms(userId, pageable));
    }

    @GetMapping("/{roomId}")
    @PreAuthorize("hasAuthority('chat:read')")
    @Operation(summary = "Get chat room by id")
    public ApiResponse<ChatRoomResponse> getRoom(@PathVariable UUID roomId) {
        return ApiResponse.ok(chatService.adminGetRoom(roomId));
    }

    @GetMapping("/{roomId}/messages")
    @PreAuthorize("hasAuthority('chat:read')")
    @Operation(summary = "List chat message history for a room")
    public ApiResponse<Page<ChatMessageResponse>> messages(
            @PathVariable UUID roomId,
            @PageableDefault(size = 20, sort = "createdAt", direction = org.springframework.data.domain.Sort.Direction.DESC)
            Pageable pageable) {
        return ApiResponse.ok(chatService.adminHistory(roomId, pageable));
    }
}
