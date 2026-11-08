package com.palpeer.promotion.web.dto;

import java.time.Instant;
import java.util.UUID;

public record BusinessInterestResponse(
        UUID id, String email, String source, Instant createdAt) {}
