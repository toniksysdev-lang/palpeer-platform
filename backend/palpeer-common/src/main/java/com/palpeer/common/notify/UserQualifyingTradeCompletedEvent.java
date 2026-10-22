package com.palpeer.common.notify;

import java.util.UUID;

/**
 * Fired when a user completes InstantEX or a settled P2P trade — used to unlock pending
 * referrer bonuses that require an invitee trade.
 */
public record UserQualifyingTradeCompletedEvent(UUID userId) {}
