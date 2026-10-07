package com.palpeer.profile.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Past;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

public record UpdateProfileRequest(
        @NotBlank @Size(max = 80) String firstName,
        @NotBlank @Size(max = 80) String lastName,
        @NotNull @Past LocalDate dateOfBirth,
        @NotBlank @Size(min = 2, max = 2) @Pattern(regexp = "[A-Za-z]{2}") String countryOfResidence,
        @NotBlank @Size(max = 100) String stateTerritory,
        @NotBlank @Size(max = 200) String addressLine1,
        @Size(max = 200) String addressLine2,
        @NotBlank @Size(max = 100) String city,
        @NotBlank @Size(max = 32) String postalCode,
        @NotBlank @Size(max = 40) String sourceOfIncome,
        @NotBlank @Size(max = 40) String monthlyTransactionEstimate
) {
}
