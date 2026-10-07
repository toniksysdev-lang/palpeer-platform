package com.palpeer.admin.web.dto;

import com.palpeer.admin.domain.UserNoteCategory;
import java.time.Instant;
import java.util.UUID;

public record UserNoteResponse(
        UUID id,
        UUID userId,
        UserNoteCategory category,
        String body,
        UUID authorUserId,
        String authorEmail,
        Instant createdAt) {
}
