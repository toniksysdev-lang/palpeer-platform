package com.palpeer.promotion.web.dto;

import jakarta.validation.constraints.NotEmpty;
import java.util.List;
import java.util.UUID;

public record DeleteBusinessInterestsRequest(
        @NotEmpty(message = "Select at least one waitlist email to delete.") List<UUID> ids) {}
