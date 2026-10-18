package com.palpeer.promotion.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateMarketingAdvertRequest(
        @NotBlank @Size(max = 200) String title,
        @NotBlank @Size(max = 500) String body,
        @NotBlank @Size(max = 1000) String imageUrl,
        @NotBlank @Size(max = 80) String ctaLabel,
        @NotBlank @Size(max = 200) String ctaPath,
        Integer sortOrder,
        Boolean active) {
}
