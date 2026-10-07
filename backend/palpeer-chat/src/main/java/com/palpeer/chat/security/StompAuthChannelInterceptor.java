package com.palpeer.chat.security;

import com.palpeer.auth.security.PalpeerUserDetailsService;
import com.palpeer.auth.security.UserPrincipal;
import com.palpeer.auth.service.JwtService;
import com.palpeer.chat.repository.ChatRoomRepository;
import java.security.Principal;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Component;

/**
 * Authenticates STOMP CONNECT with Bearer JWT and authorises SUBSCRIBE / SEND.
 *
 * Allowed destinations:
 * - SUBSCRIBE /topic/rooms.{roomId} and /topic/rooms.{roomId}.reads: room participants only
 * - SUBSCRIBE /user/queue/**: per-user queues (Spring scopes these to the session user, whose
 *   principal name is the user id)
 * - SEND /app/**: application handlers, which re-check authorisation
 * Everything else is denied, including client SENDs straight to broker destinations.
 *
 * CONTRACT_PENDING (P10-03): exact WS auth header contract for mobile clients.
 */
@Component
@RequiredArgsConstructor
public class StompAuthChannelInterceptor implements ChannelInterceptor {

    static final String ROOM_TOPIC_PREFIX = "/topic/rooms.";
    static final String READS_SUFFIX = ".reads";
    static final String USER_QUEUE_PREFIX = "/user/queue/";
    static final String APP_PREFIX = "/app/";

    private final JwtService jwtService;
    private final PalpeerUserDetailsService userDetailsService;
    private final ChatRoomRepository chatRoomRepository;

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null || accessor.getCommand() == null) {
            return message;
        }

        switch (accessor.getCommand()) {
            case CONNECT -> authenticate(accessor);
            case SUBSCRIBE -> authorizeSubscribe(requireUserId(accessor), accessor.getDestination());
            case SEND -> authorizeSend(requireUserId(accessor), accessor.getDestination());
            default -> {
                // UNSUBSCRIBE, DISCONNECT, ACK, NACK, heartbeats need no extra checks
            }
        }
        return message;
    }

    private void authenticate(StompHeaderAccessor accessor) {
        String token = resolveToken(accessor);
        if (token == null || token.isBlank()) {
            throw new IllegalArgumentException("Missing JWT for STOMP CONNECT");
        }
        if (!jwtService.isAccessToken(token)) {
            throw new IllegalArgumentException("Invalid access token for STOMP CONNECT");
        }
        UUID userId = jwtService.extractUserId(token);
        UserDetails userDetails = userDetailsService.loadUserById(userId);
        if (!userDetails.isEnabled()) {
            throw new IllegalArgumentException("User disabled");
        }
        accessor.setUser(new StompAuthentication(userDetails, userId));
    }

    /** STOMP principal named by user id, so {@code /user/queue/**} sends can target a user id. */
    static final class StompAuthentication extends UsernamePasswordAuthenticationToken {

        private final String name;

        StompAuthentication(UserDetails userDetails, UUID userId) {
            super(userDetails, null, userDetails.getAuthorities());
            this.name = userId.toString();
        }

        @Override
        public String getName() {
            return name;
        }
    }

    private void authorizeSubscribe(UUID userId, String destination) {
        if (destination == null) {
            throw new AccessDeniedException("Subscription destination required");
        }
        if (destination.startsWith(USER_QUEUE_PREFIX)) {
            return;
        }
        if (destination.startsWith(ROOM_TOPIC_PREFIX)) {
            String room = destination.substring(ROOM_TOPIC_PREFIX.length());
            if (room.endsWith(READS_SUFFIX)) {
                room = room.substring(0, room.length() - READS_SUFFIX.length());
            }
            UUID roomId = parseUuid(room);
            if (roomId != null && chatRoomRepository.findByIdAndParticipant(roomId, userId).isPresent()) {
                return;
            }
        }
        throw new AccessDeniedException("Subscription not permitted");
    }

    private static void authorizeSend(UUID userId, String destination) {
        if (destination == null || !destination.startsWith(APP_PREFIX)) {
            throw new AccessDeniedException("Send destination not permitted");
        }
    }

    private static UUID requireUserId(StompHeaderAccessor accessor) {
        Principal user = accessor.getUser();
        if (user instanceof Authentication authentication
                && authentication.getPrincipal() instanceof UserPrincipal principal) {
            return principal.getId();
        }
        throw new AccessDeniedException("Unauthenticated STOMP frame");
    }

    private static UUID parseUuid(String value) {
        try {
            return UUID.fromString(value);
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    private String resolveToken(StompHeaderAccessor accessor) {
        List<String> auth = accessor.getNativeHeader("Authorization");
        if (auth != null && !auth.isEmpty()) {
            String value = auth.getFirst();
            if (value != null && value.startsWith("Bearer ")) {
                return value.substring(7);
            }
        }
        List<String> tokenHeader = accessor.getNativeHeader("token");
        if (tokenHeader != null && !tokenHeader.isEmpty()) {
            return tokenHeader.getFirst();
        }
        return null;
    }
}
