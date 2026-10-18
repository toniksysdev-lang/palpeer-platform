package com.palpeer.chat.web.dto;

import java.util.UUID;

/**
 * Open (or return) a chat room for either a P2P order or a negotiation.
 * Exactly one of {@code p2pOrderId} / {@code negotiationId} must be set (enforced in
 * {@code ChatService}).
 */
public record CreateChatRoomRequest(UUID p2pOrderId, UUID negotiationId) {}
