package com.palpeer.chat.web;

import com.palpeer.auth.security.UserPrincipal;
import com.palpeer.chat.service.ChatService;
import com.palpeer.chat.web.dto.SendChatMessageRequest;
import jakarta.validation.Valid;
import java.security.Principal;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Controller;

/**
 * STOMP destinations:
 * - send: /app/rooms/{roomId}/send
 * - subscribe: /topic/rooms.{roomId}
 */
@Controller
@RequiredArgsConstructor
public class ChatStompController {

    private final ChatService chatService;

    @MessageMapping("/rooms/{roomId}/send")
    public void send(
            @DestinationVariable UUID roomId,
            @Valid @Payload SendChatMessageRequest request,
            Principal principal) {
        // Broadcast is owned by ChatService → /topic/rooms.{roomId}
        chatService.send(resolveUserId(principal), roomId, request);
    }

    private UUID resolveUserId(Principal principal) {
        if (principal instanceof org.springframework.security.core.Authentication authentication
                && authentication.getPrincipal() instanceof UserPrincipal userPrincipal) {
            return userPrincipal.getId();
        }
        throw new IllegalStateException("Unauthenticated STOMP principal");
    }
}
