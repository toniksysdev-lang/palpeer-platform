package com.palpeer.auth.web.dto;

import jakarta.validation.constraints.NotBlank;

/** Mobile/native Google Sign-In ID token exchange. */
public record GoogleAuthRequest(@NotBlank String idToken) {}
