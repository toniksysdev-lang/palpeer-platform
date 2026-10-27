package com.palpeer.wallet.interac.dto;

import java.time.Instant;
import java.util.UUID;

public record InteracAddressResponse(
        UUID id, String email, String firstName, String lastName, Instant createdAt) {}
