package com.palpeer.chat.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

import com.palpeer.auth.security.PalpeerUserDetailsService;
import com.palpeer.auth.security.UserPrincipal;
import com.palpeer.auth.service.JwtService;
import com.palpeer.chat.domain.ChatRoom;
import com.palpeer.chat.repository.ChatRoomRepository;
import com.palpeer.user.domain.User;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;

@ExtendWith(MockitoExtension.class)
class StompAuthChannelInterceptorTest {

    @Mock private JwtService jwtService;
    @Mock private PalpeerUserDetailsService userDetailsService;
    @Mock private ChatRoomRepository chatRoomRepository;
    @Mock private MessageChannel channel;

    private StompAuthChannelInterceptor interceptor;
    private UUID userId;
    private UsernamePasswordAuthenticationToken authentication;

    @BeforeEach
    void setUp() {
        interceptor = new StompAuthChannelInterceptor(jwtService, userDetailsService, chatRoomRepository);
        userId = UUID.randomUUID();
        User user = new User();
        user.setId(userId);
        user.setEmail("member@example.com");
        UserPrincipal principal = new UserPrincipal(user);
        authentication = new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities());
    }

    @Test
    void participantMaySubscribeToOwnRoom() {
        UUID roomId = UUID.randomUUID();
        when(chatRoomRepository.findByIdAndParticipant(roomId, userId)).thenReturn(Optional.of(new ChatRoom()));

        assertThatCode(() -> interceptor.preSend(frame(StompCommand.SUBSCRIBE, "/topic/rooms." + roomId, true), channel))
                .doesNotThrowAnyException();
    }

    @Test
    void nonParticipantCannotSubscribeToRoom() {
        UUID roomId = UUID.randomUUID();
        when(chatRoomRepository.findByIdAndParticipant(roomId, userId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> interceptor.preSend(frame(StompCommand.SUBSCRIBE, "/topic/rooms." + roomId, true), channel))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void participantMaySubscribeToRoomReadReceipts() {
        UUID roomId = UUID.randomUUID();
        when(chatRoomRepository.findByIdAndParticipant(roomId, userId)).thenReturn(Optional.of(new ChatRoom()));

        assertThatCode(() -> interceptor.preSend(
                        frame(StompCommand.SUBSCRIBE, "/topic/rooms." + roomId + ".reads", true), channel))
                .doesNotThrowAnyException();
    }

    @Test
    void nonParticipantCannotSubscribeToRoomReadReceipts() {
        UUID roomId = UUID.randomUUID();
        when(chatRoomRepository.findByIdAndParticipant(roomId, userId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> interceptor.preSend(
                        frame(StompCommand.SUBSCRIBE, "/topic/rooms." + roomId + ".reads", true), channel))
                .isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> interceptor.preSend(
                        frame(StompCommand.SUBSCRIBE, "/topic/rooms." + roomId + ".typing", true), channel))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void connectSetsPrincipalNamedByUserId() {
        User user = new User();
        user.setId(userId);
        user.setEmail("member@example.com");
        user.setEnabled(true);
        UserPrincipal principal = new UserPrincipal(user);
        when(jwtService.isAccessToken("tok")).thenReturn(true);
        when(jwtService.extractUserId("tok")).thenReturn(userId);
        when(userDetailsService.loadUserById(userId)).thenReturn(principal);

        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.CONNECT);
        accessor.setNativeHeader("Authorization", "Bearer tok");
        accessor.setLeaveMutable(true);
        Message<byte[]> connect = MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());

        interceptor.preSend(connect, channel);

        StompHeaderAccessor result = StompHeaderAccessor.wrap(connect);
        assertThat(result.getUser()).isNotNull();
        assertThat(result.getUser().getName()).isEqualTo(userId.toString());
    }

    @Test
    void unknownTopicsAndWildcardsAreDenied() {
        assertThatThrownBy(() -> interceptor.preSend(frame(StompCommand.SUBSCRIBE, "/topic/rooms.*", true), channel))
                .isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> interceptor.preSend(frame(StompCommand.SUBSCRIBE, "/topic/anything", true), channel))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void userQueueSubscriptionIsAllowed() {
        assertThatCode(() -> interceptor.preSend(frame(StompCommand.SUBSCRIBE, "/user/queue/notifications", true), channel))
                .doesNotThrowAnyException();
    }

    @Test
    void unauthenticatedSubscribeIsDenied() {
        assertThatThrownBy(() -> interceptor.preSend(frame(StompCommand.SUBSCRIBE, "/user/queue/notifications", false), channel))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void clientCannotSendDirectlyToBrokerTopics() {
        assertThatThrownBy(() -> interceptor.preSend(
                        frame(StompCommand.SEND, "/topic/rooms." + UUID.randomUUID(), true), channel))
                .isInstanceOf(AccessDeniedException.class);
        assertThatCode(() -> interceptor.preSend(
                        frame(StompCommand.SEND, "/app/rooms/" + UUID.randomUUID() + "/send", true), channel))
                .doesNotThrowAnyException();
    }

    private Message<byte[]> frame(StompCommand command, String destination, boolean authenticated) {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(command);
        accessor.setDestination(destination);
        if (authenticated) {
            accessor.setUser(authentication);
        }
        accessor.setLeaveMutable(true);
        return MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
    }
}
