package com.palpeer.promotion.web.dto;

import jakarta.validation.constraints.Size;

public record UpdatePromotionCampaignRequest(
        @Size(max = 8000) String formulaJson, @Size(max = 8000) String eligibilityJson) {}
