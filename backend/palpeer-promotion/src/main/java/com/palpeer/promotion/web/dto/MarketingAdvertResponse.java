package com.palpeer.promotion.web.dto;

import java.time.Instant;
import java.util.UUID;

public record MarketingAdvertResponse(
        UUID id,
        String title,
        String body,
        String imageUrl,
        String ctaLabel,
        String ctaPath,
        int sortOrder,
        boolean active,
        Instant createdAt,
        Instant updatedAt) {
}
