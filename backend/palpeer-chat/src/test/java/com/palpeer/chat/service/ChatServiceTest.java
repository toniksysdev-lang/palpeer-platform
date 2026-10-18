package com.palpeer.chat.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.palpeer.chat.domain.ChatMessage;
import com.palpeer.chat.domain.ChatRoom;
import com.palpeer.chat.repository.ChatMessageRepository;
import com.palpeer.chat.repository.ChatRoomRepository;
import com.palpeer.chat.web.dto.ChatMessageResponse;
import com.palpeer.chat.web.dto.ChatReadReceiptResponse;
import com.palpeer.chat.web.dto.ChatRoomResponse;
import com.palpeer.chat.web.dto.CreateChatRoomRequest;
import com.palpeer.chat.web.dto.MarkChatReadRequest;
import com.palpeer.chat.web.dto.SendChatMessageRequest;
import com.palpeer.common.exception.BusinessException;
import com.palpeer.common.exception.ResourceNotFoundException;
import com.palpeer.negotiation.domain.Negotiation;
import com.palpeer.negotiation.domain.NegotiationStatus;
import com.palpeer.negotiation.repository.NegotiationRepository;
import com.palpeer.p2p.repository.P2POrderRepository;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.messaging.simp.SimpMessagingTemplate;

@ExtendWith(MockitoExtension.class)
class ChatServiceTest {

    @Mock private ChatRoomRepository chatRoomRepository;
    @Mock private ChatMessageRepository chatMessageRepository;
    @Mock private P2POrderRepository p2POrderRepository;
    @Mock private NegotiationRepository negotiationRepository;
    @Mock private SimpMessagingTemplate messagingTemplate;

    @InjectMocks private ChatService chatService;

    @Test
    void send_persistsAndBroadcasts() {
        UUID userId = UUID.randomUUID();
        UUID roomId = UUID.randomUUID();
        ChatRoom room = new ChatRoom();
        room.setId(roomId);
        room.setParticipantAId(userId);
        room.setParticipantBId(UUID.randomUUID());

        when(chatRoomRepository.findByIdAndParticipant(roomId, userId)).thenReturn(Optional.of(room));
        when(chatMessageRepository.save(any(ChatMessage.class))).thenAnswer(inv -> {
            ChatMessage m = inv.getArgument(0);
            m.setId(UUID.randomUUID());
            return m;
        });

        ChatMessageResponse response = chatService.send(
                userId, roomId, new SendChatMessageRequest("hello", "c-1"));

        assertThat(response.content()).isEqualTo("hello");
        assertThat(response.clientMessageId()).isEqualTo("c-1");
        verify(messagingTemplate).convertAndSend(eq("/topic/rooms." + roomId), any(ChatMessageResponse.class));
    }

    @Test
    void send_replaysClientMessageId() {
        UUID userId = UUID.randomUUID();
        UUID roomId = UUID.randomUUID();
        ChatRoom room = new ChatRoom();
        room.setId(roomId);
        room.setParticipantAId(userId);
        room.setParticipantBId(UUID.randomUUID());

        ChatMessage existing = new ChatMessage();
        existing.setId(UUID.randomUUID());
        existing.setRoomId(roomId);
        existing.setSenderId(userId);
        existing.setContent("hello");
        existing.setClientMessageId("c-1");

        when(chatRoomRepository.findByIdAndParticipant(roomId, userId)).thenReturn(Optional.of(room));
        when(chatMessageRepository.findByRoomIdAndClientMessageId(roomId, "c-1"))
                .thenReturn(Optional.of(existing));

        ChatMessageResponse response = chatService.send(
                userId, roomId, new SendChatMessageRequest("hello", "c-1"));

        assertThat(response.id()).isEqualTo(existing.getId());
    }

    @Test
    void markRead_advancesCallerMarkerAndBroadcastsReceipt() {
        UUID userId = UUID.randomUUID();
        UUID otherId = UUID.randomUUID();
        UUID roomId = UUID.randomUUID();
        ChatRoom room = room(roomId, otherId, userId);
        ChatMessage message = message(roomId, otherId, Instant.parse("2026-09-29T10:00:00Z"));
        ChatRoom updated = room(roomId, otherId, userId);
        updated.setParticipantBLastReadAt(message.getCreatedAt());

        when(chatRoomRepository.findByIdAndParticipant(roomId, userId)).thenReturn(Optional.of(room));
        when(chatMessageRepository.findByIdAndRoomId(message.getId(), roomId)).thenReturn(Optional.of(message));
        when(chatRoomRepository.advanceParticipantBRead(roomId, message.getCreatedAt())).thenReturn(1);
        when(chatRoomRepository.findById(roomId)).thenReturn(Optional.of(updated));

        ChatRoomResponse response = chatService.markRead(userId, roomId, new MarkChatReadRequest(message.getId()));

        assertThat(response.participantBLastReadAt()).isEqualTo(message.getCreatedAt());
        verify(chatRoomRepository, never()).advanceParticipantARead(any(), any());
        verify(messagingTemplate).convertAndSend(
                "/topic/rooms." + roomId + ".reads",
                new ChatReadReceiptResponse(roomId, userId, message.getCreatedAt()));
    }

    @Test
    void markRead_doesNotBroadcastWhenMarkerDoesNotAdvance() {
        UUID userId = UUID.randomUUID();
        UUID roomId = UUID.randomUUID();
        ChatRoom room = room(roomId, userId, UUID.randomUUID());
        ChatMessage message = message(roomId, room.getParticipantBId(), Instant.parse("2026-09-29T09:00:00Z"));

        when(chatRoomRepository.findByIdAndParticipant(roomId, userId)).thenReturn(Optional.of(room));
        when(chatMessageRepository.findByIdAndRoomId(message.getId(), roomId)).thenReturn(Optional.of(message));
        when(chatRoomRepository.advanceParticipantARead(roomId, message.getCreatedAt())).thenReturn(0);
        when(chatRoomRepository.findById(roomId)).thenReturn(Optional.of(room));

        chatService.markRead(userId, roomId, new MarkChatReadRequest(message.getId()));

        verifyNoInteractions(messagingTemplate);
    }

    @Test
    void markRead_rejectsMessageFromAnotherRoom() {
        UUID userId = UUID.randomUUID();
        UUID roomId = UUID.randomUUID();
        UUID messageId = UUID.randomUUID();
        when(chatRoomRepository.findByIdAndParticipant(roomId, userId))
                .thenReturn(Optional.of(room(roomId, userId, UUID.randomUUID())));
        when(chatMessageRepository.findByIdAndRoomId(messageId, roomId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> chatService.markRead(userId, roomId, new MarkChatReadRequest(messageId)))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessage("Chat message not found");
        verify(chatRoomRepository, never()).advanceParticipantARead(any(), any());
    }

    @Test
    void markRead_nonParticipantGetsNotFound() {
        UUID userId = UUID.randomUUID();
        UUID roomId = UUID.randomUUID();
        when(chatRoomRepository.findByIdAndParticipant(roomId, userId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> chatService.markRead(userId, roomId, new MarkChatReadRequest(UUID.randomUUID())))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void createRoom_forNegotiation_isIdempotent() {
        UUID requester = UUID.randomUUID();
        UUID counterparty = UUID.randomUUID();
        UUID negotiationId = UUID.randomUUID();
        Negotiation negotiation = new Negotiation();
        negotiation.setId(negotiationId);
        negotiation.setRequesterId(requester);
        negotiation.setCounterpartyId(counterparty);
        negotiation.setStatus(NegotiationStatus.OPEN);

        when(negotiationRepository.findById(negotiationId)).thenReturn(Optional.of(negotiation));
        when(chatRoomRepository.findByNegotiationId(negotiationId)).thenReturn(Optional.empty());
        when(chatRoomRepository.save(any(ChatRoom.class))).thenAnswer(inv -> {
            ChatRoom room = inv.getArgument(0);
            room.setId(UUID.randomUUID());
            return room;
        });

        ChatRoomResponse created = chatService.createRoom(
                counterparty, new CreateChatRoomRequest(null, negotiationId));

        assertThat(created.negotiationId()).isEqualTo(negotiationId);
        assertThat(created.p2pOrderId()).isNull();
        assertThat(created.participantAId()).isEqualTo(requester);
        assertThat(created.participantBId()).isEqualTo(counterparty);
    }

    @Test
    void createRoom_requiresExactlyOneScope() {
        UUID userId = UUID.randomUUID();

        assertThatThrownBy(() -> chatService.createRoom(userId, new CreateChatRoomRequest(null, null)))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> {
                    BusinessException business = (BusinessException) ex;
                    assertThat(business.getCode()).isEqualTo("CHAT_SCOPE_REQUIRED");
                    assertThat(business.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
                });

        UUID orderId = UUID.randomUUID();
        UUID negotiationId = UUID.randomUUID();
        assertThatThrownBy(() ->
                        chatService.createRoom(userId, new CreateChatRoomRequest(orderId, negotiationId)))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> assertThat(((BusinessException) ex).getCode()).isEqualTo("CHAT_SCOPE_REQUIRED"));

        verifyNoInteractions(negotiationRepository, p2POrderRepository, chatRoomRepository);
    }

    private static ChatRoom room(UUID roomId, UUID participantA, UUID participantB) {
        ChatRoom room = new ChatRoom();
        room.setId(roomId);
        room.setParticipantAId(participantA);
        room.setParticipantBId(participantB);
        return room;
    }

    private static ChatMessage message(UUID roomId, UUID senderId, Instant createdAt) {
        ChatMessage message = new ChatMessage();
        message.setId(UUID.randomUUID());
        message.setRoomId(roomId);
        message.setSenderId(senderId);
        message.setContent("hi");
        message.setCreatedAt(createdAt);
        return message;
    }
}
