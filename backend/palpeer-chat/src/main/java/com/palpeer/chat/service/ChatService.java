package com.palpeer.chat.service;

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
import com.palpeer.negotiation.repository.NegotiationRepository;
import com.palpeer.p2p.domain.P2POrder;
import com.palpeer.p2p.repository.P2POrderRepository;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ChatService {

    private final ChatRoomRepository chatRoomRepository;
    private final ChatMessageRepository chatMessageRepository;
    private final P2POrderRepository p2POrderRepository;
    private final NegotiationRepository negotiationRepository;
    private final SimpMessagingTemplate messagingTemplate;

    @Transactional
    public ChatRoomResponse createRoom(UUID userId, CreateChatRoomRequest request) {
        UUID orderId = request.p2pOrderId();
        UUID negotiationId = request.negotiationId();
        // Mirror exchange quote XOR checks: bean @AssertTrue on records is fragile (and exposed
        // "exactlyOneScope" in OpenAPI), so enforce the scope here with a clear 400.
        if ((orderId == null) == (negotiationId == null)) {
            throw new BusinessException(
                    "CHAT_SCOPE_REQUIRED",
                    "Provide exactly one of p2pOrderId or negotiationId",
                    HttpStatus.BAD_REQUEST);
        }
        if (negotiationId != null) {
            return createNegotiationRoom(userId, negotiationId);
        }
        return createOrderRoom(userId, orderId);
    }

    private ChatRoomResponse createOrderRoom(UUID userId, UUID p2pOrderId) {
        P2POrder order = p2POrderRepository.findById(p2pOrderId)
                .orElseThrow(() -> new ResourceNotFoundException("P2P order not found"));
        if (!order.getRequesterId().equals(userId) && !order.getAcceptorId().equals(userId)) {
            throw new BusinessException(
                    "CHAT_NOT_PARTICIPANT", "Not a participant of this order", HttpStatus.FORBIDDEN);
        }

        return chatRoomRepository.findByP2pOrderId(order.getId())
                .map(room -> toRoomResponse(room, userId))
                .orElseGet(() -> {
                    ChatRoom room = new ChatRoom();
                    room.setP2pOrderId(order.getId());
                    room.setParticipantAId(order.getRequesterId());
                    room.setParticipantBId(order.getAcceptorId());
                    chatRoomRepository.save(room);
                    return toRoomResponse(room, userId);
                });
    }

    private ChatRoomResponse createNegotiationRoom(UUID userId, UUID negotiationId) {
        Negotiation negotiation = negotiationRepository
                .findById(negotiationId)
                .orElseThrow(() -> new ResourceNotFoundException("Negotiation not found"));
        if (!negotiation.getRequesterId().equals(userId)
                && !negotiation.getCounterpartyId().equals(userId)) {
            throw new BusinessException(
                    "CHAT_NOT_PARTICIPANT",
                    "Not a participant of this negotiation",
                    HttpStatus.FORBIDDEN);
        }

        return chatRoomRepository.findByNegotiationId(negotiation.getId())
                .map(room -> toRoomResponse(room, userId))
                .orElseGet(() -> {
                    ChatRoom room = new ChatRoom();
                    room.setNegotiationId(negotiation.getId());
                    room.setParticipantAId(negotiation.getRequesterId());
                    room.setParticipantBId(negotiation.getCounterpartyId());
                    chatRoomRepository.save(room);
                    return toRoomResponse(room, userId);
                });
    }

    @Transactional(readOnly = true)
    public List<ChatRoomResponse> listRooms(UUID userId) {
        return chatRoomRepository.findByParticipant(userId).stream()
                .map(room -> toRoomResponse(room, userId))
                .toList();
    }

    @Transactional(readOnly = true)
    public ChatRoomResponse getRoom(UUID userId, UUID roomId) {
        return toRoomResponse(requireParticipant(userId, roomId), userId);
    }

    /** Total unread chat messages across all of the caller's rooms. */
    @Transactional(readOnly = true)
    public long unreadCount(UUID userId) {
        return chatMessageRepository.countUnreadForUser(userId);
    }

    @Transactional(readOnly = true)
    public Page<ChatMessageResponse> history(UUID userId, UUID roomId, Pageable pageable) {
        requireParticipant(userId, roomId);
        return chatMessageRepository.findByRoomIdOrderByCreatedAtDesc(roomId, pageable)
                .map(this::toMessageResponse);
    }

    /** Admin inventory — no participant check. */
    @Transactional(readOnly = true)
    public Page<ChatRoomResponse> adminListRooms(UUID userId, Pageable pageable) {
        Specification<ChatRoom> spec = (root, query, cb) -> userId == null
                ? cb.conjunction()
                : cb.or(
                        cb.equal(root.get("participantAId"), userId),
                        cb.equal(root.get("participantBId"), userId));
        return chatRoomRepository.findAll(spec, pageable).map(this::toRoomResponse);
    }

    /** Admin inventory — no participant check. */
    @Transactional(readOnly = true)
    public ChatRoomResponse adminGetRoom(UUID roomId) {
        ChatRoom room = chatRoomRepository.findById(roomId)
                .orElseThrow(() -> new ResourceNotFoundException("Chat room not found"));
        return toRoomResponse(room);
    }

    /** Admin inventory — message history without participant check. */
    @Transactional(readOnly = true)
    public Page<ChatMessageResponse> adminHistory(UUID roomId, Pageable pageable) {
        if (!chatRoomRepository.existsById(roomId)) {
            throw new ResourceNotFoundException("Chat room not found");
        }
        return chatMessageRepository.findByRoomIdOrderByCreatedAtDesc(roomId, pageable)
                .map(this::toMessageResponse);
    }

    /**
     * Persist and broadcast a chat message. clientMessageId supports reconnect/replay idempotency.
     */
    @Transactional
    public ChatMessageResponse send(UUID senderId, UUID roomId, SendChatMessageRequest request) {
        ChatRoom room = requireParticipant(senderId, roomId);

        if (request.clientMessageId() != null && !request.clientMessageId().isBlank()) {
            var existing = chatMessageRepository.findByRoomIdAndClientMessageId(roomId, request.clientMessageId());
            if (existing.isPresent()) {
                return toMessageResponse(existing.get());
            }
        }

        ChatMessage message = new ChatMessage();
        message.setRoomId(roomId);
        message.setSenderId(senderId);
        message.setContent(request.content().trim());
        message.setClientMessageId(
                request.clientMessageId() == null || request.clientMessageId().isBlank()
                        ? null
                        : request.clientMessageId().trim());
        chatMessageRepository.save(message);

        ChatMessageResponse response = toMessageResponse(message);
        messagingTemplate.convertAndSend("/topic/rooms." + roomId, response);
        UUID recipientId = room.getParticipantAId().equals(senderId)
                ? room.getParticipantBId()
                : room.getParticipantAId();
        messagingTemplate.convertAndSendToUser(recipientId.toString(), "/queue/chat", response);
        return response;
    }

    /**
     * Records that the caller has read the room up to {@code messageId}. The marker only moves
     * forward; when it advances, the receipt is broadcast on {@code /topic/rooms.{roomId}.reads}.
     */
    @Transactional
    public ChatRoomResponse markRead(UUID userId, UUID roomId, MarkChatReadRequest request) {
        ChatRoom room = requireParticipant(userId, roomId);
        ChatMessage message = chatMessageRepository.findByIdAndRoomId(request.messageId(), roomId)
                .orElseThrow(() -> new ResourceNotFoundException("Chat message not found"));
        Instant readAt = message.getCreatedAt();
        int advanced = room.getParticipantAId().equals(userId)
                ? chatRoomRepository.advanceParticipantARead(roomId, readAt)
                : chatRoomRepository.advanceParticipantBRead(roomId, readAt);

        ChatRoom updated = chatRoomRepository.findById(roomId)
                .orElseThrow(() -> new ResourceNotFoundException("Chat room not found"));
        if (advanced > 0) {
            messagingTemplate.convertAndSend(
                    "/topic/rooms." + roomId + ".reads",
                    new ChatReadReceiptResponse(roomId, userId, readAt));
        }
        return toRoomResponse(updated, userId);
    }

    private ChatRoom requireParticipant(UUID userId, UUID roomId) {
        return chatRoomRepository.findByIdAndParticipant(roomId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Chat room not found"));
    }

    /** Admin / inventory view — unread is always 0 (no caller context). */
    private ChatRoomResponse toRoomResponse(ChatRoom room) {
        return toRoomResponse(room, null);
    }

    private ChatRoomResponse toRoomResponse(ChatRoom room, UUID viewerId) {
        long unread = 0L;
        if (viewerId != null) {
            Instant lastRead = room.getParticipantAId().equals(viewerId)
                    ? room.getParticipantALastReadAt()
                    : room.getParticipantBLastReadAt();
            unread = chatMessageRepository.countUnreadInRoom(room.getId(), viewerId, lastRead);
        }
        return new ChatRoomResponse(
                room.getId(),
                room.getP2pOrderId(),
                room.getNegotiationId(),
                room.getParticipantAId(),
                room.getParticipantBId(),
                room.getCreatedAt(),
                room.getParticipantALastReadAt(),
                room.getParticipantBLastReadAt(),
                unread);
    }

    private ChatMessageResponse toMessageResponse(ChatMessage message) {
        return new ChatMessageResponse(
                message.getId(),
                message.getRoomId(),
                message.getSenderId(),
                message.getContent(),
                message.getClientMessageId(),
                message.getCreatedAt());
    }
}
