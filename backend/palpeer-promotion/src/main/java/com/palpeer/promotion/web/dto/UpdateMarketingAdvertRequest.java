package com.palpeer.promotion.web.dto;

import jakarta.validation.constraints.Size;

public record UpdateMarketingAdvertRequest(
        @Size(max = 200) String title,
        @Size(max = 500) String body,
        @Size(max = 1000) String imageUrl,
        @Size(max = 80) String ctaLabel,
        @Size(max = 200) String ctaPath,
        Integer sortOrder,
        Boolean active) {
}
