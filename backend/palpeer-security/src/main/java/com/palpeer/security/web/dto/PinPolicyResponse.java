package com.palpeer.security.web.dto;

import java.math.BigDecimal;
import java.time.Instant;

public record PinPolicyResponse(int maxWrongAttempts, BigDecimal lockoutHours, Instant updatedAt) {}
