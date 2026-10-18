package com.palpeer.chat.web;

import com.palpeer.auth.security.UserPrincipal;
import com.palpeer.chat.service.ChatService;
import com.palpeer.chat.web.dto.ChatMessageResponse;
import com.palpeer.chat.web.dto.ChatRoomResponse;
import com.palpeer.chat.web.dto.CreateChatRoomRequest;
import com.palpeer.chat.web.dto.MarkChatReadRequest;
import com.palpeer.chat.web.dto.SendChatMessageRequest;
import com.palpeer.common.api.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/chat")
@RequiredArgsConstructor
@Tag(name = "Chat")
@SecurityRequirement(name = "bearerAuth")
public class ChatRestController {

    private final ChatService chatService;

    @PostMapping("/rooms")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Create or get chat room for a P2P order or negotiation")
    public ApiResponse<ChatRoomResponse> createRoom(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestBody CreateChatRoomRequest request) {
        return ApiResponse.ok("Chat room ready", chatService.createRoom(principal.getId(), request));
    }

    @GetMapping("/rooms")
    @Operation(summary = "List my chat rooms")
    public ApiResponse<List<ChatRoomResponse>> listRooms(@AuthenticationPrincipal UserPrincipal principal) {
        return ApiResponse.ok(chatService.listRooms(principal.getId()));
    }

    @GetMapping("/rooms/{roomId}")
    @Operation(summary = "Get chat room")
    public ApiResponse<ChatRoomResponse> getRoom(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID roomId) {
        return ApiResponse.ok(chatService.getRoom(principal.getId(), roomId));
    }

    @GetMapping("/rooms/{roomId}/messages")
    @Operation(summary = "Message history (also used after reconnect)")
    public ApiResponse<Page<ChatMessageResponse>> history(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID roomId,
            @PageableDefault(size = 50) Pageable pageable) {
        return ApiResponse.ok(chatService.history(principal.getId(), roomId, pageable));
    }

    @PostMapping("/rooms/{roomId}/messages")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Send message via REST (also broadcast on STOMP topic)")
    public ApiResponse<ChatMessageResponse> sendRest(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID roomId,
            @Valid @RequestBody SendChatMessageRequest request) {
        return ApiResponse.ok(chatService.send(principal.getId(), roomId, request));
    }

    @PostMapping("/rooms/{roomId}/read")
    @Operation(summary = "Mark the room read up to a message (read receipts)")
    public ApiResponse<ChatRoomResponse> markRead(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID roomId,
            @Valid @RequestBody MarkChatReadRequest request) {
        return ApiResponse.ok(chatService.markRead(principal.getId(), roomId, request));
    }
}
