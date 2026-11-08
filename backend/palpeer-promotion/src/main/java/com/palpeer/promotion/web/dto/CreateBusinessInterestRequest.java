package com.palpeer.promotion.web.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateBusinessInterestRequest(
        @NotBlank @Email @Size(max = 320) String email) {}
