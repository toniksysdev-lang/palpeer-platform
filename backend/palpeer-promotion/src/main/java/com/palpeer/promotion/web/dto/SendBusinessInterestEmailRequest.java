package com.palpeer.promotion.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;

public record SendBusinessInterestEmailRequest(
        @NotBlank @Size(max = 200) String subject,
        @NotBlank @Size(max = 5000) String body,
        /** When true, email every waitlist address (ignores {@code ids}). */
        Boolean all,
        /** Specific waitlist entry ids to email. Required when {@code all} is not true. */
        List<UUID> ids) {}
