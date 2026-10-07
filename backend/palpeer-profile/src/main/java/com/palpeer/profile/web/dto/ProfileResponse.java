package com.palpeer.profile.web.dto;

import java.time.LocalDate;
import java.util.UUID;

public record ProfileResponse(
        UUID id,
        UUID userId,
        String firstName,
        String lastName,
        LocalDate dateOfBirth,
        String countryOfResidence,
        String stateTerritory,
        String addressLine1,
        String addressLine2,
        String city,
        String postalCode,
        String sourceOfIncome,
        String monthlyTransactionEstimate,
        boolean complete
) {
}
