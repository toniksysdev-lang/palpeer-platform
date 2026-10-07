package com.palpeer.profile.domain;

import com.palpeer.common.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

/**
 * User profile aggregate — personal / residential details collected after signup.
 */
@Getter
@Setter
@Entity
@Table(
        name = "profiles",
        uniqueConstraints = @UniqueConstraint(name = "uk_profiles_user_id", columnNames = "user_id")
)
public class Profile extends BaseEntity {

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "first_name", length = 80)
    private String firstName;

    @Column(name = "last_name", length = 80)
    private String lastName;

    @Column(name = "date_of_birth")
    private LocalDate dateOfBirth;

    @Column(name = "country_of_residence", length = 2)
    private String countryOfResidence;

    @Column(name = "state_territory", length = 100)
    private String stateTerritory;

    @Column(name = "address_line1", length = 200)
    private String addressLine1;

    @Column(name = "address_line2", length = 200)
    private String addressLine2;

    @Column(name = "city", length = 100)
    private String city;

    @Column(name = "postal_code", length = 32)
    private String postalCode;

    @Column(name = "source_of_income", length = 40)
    private String sourceOfIncome;

    @Column(name = "monthly_transaction_estimate", length = 40)
    private String monthlyTransactionEstimate;
}
