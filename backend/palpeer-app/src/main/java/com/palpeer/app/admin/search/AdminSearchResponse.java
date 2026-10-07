package com.palpeer.app.admin.search;

import com.palpeer.admin.web.dto.AdminUserSummaryResponse;
import java.util.List;
import java.util.UUID;

public record AdminSearchResponse(
        String query,
        List<AdminUserSummaryResponse> users,
        List<Match> matches
) {

    public enum MatchType {
        USER,
        WALLET,
        CARD,
        KYC_CASE,
        P2P_REQUEST,
        P2P_ORDER,
        NEGOTIATION,
        CHAT_ROOM,
        REFERRAL,
        TRANSACTION
    }

    /** {@code path} is the admin UI route for the entity. */
    public record Match(MatchType type, UUID id, String label, String path) {
    }
}
