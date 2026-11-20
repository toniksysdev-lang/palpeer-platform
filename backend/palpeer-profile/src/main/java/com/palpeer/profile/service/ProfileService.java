package com.palpeer.profile.service;

import com.palpeer.common.exception.BusinessException;
import com.palpeer.common.exception.ResourceNotFoundException;
import com.palpeer.profile.domain.Profile;
import com.palpeer.profile.repository.ProfileRepository;
import com.palpeer.profile.web.dto.CreateProfileRequest;
import com.palpeer.profile.web.dto.ProfileResponse;
import com.palpeer.profile.web.dto.UpdateProfileRequest;
import com.palpeer.user.repository.UserRepository;
import java.time.LocalDate;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
@RequiredArgsConstructor
public class ProfileService {

    private final ProfileRepository profileRepository;
    private final UserRepository userRepository;

    @Transactional
    public ProfileResponse create(UUID userId, CreateProfileRequest request) {
        if (!userRepository.existsById(userId)) {
            throw new ResourceNotFoundException("User not found");
        }
        if (profileRepository.existsByUserId(userId)) {
            throw new BusinessException("PROFILE_EXISTS", "Profile already exists", HttpStatus.CONFLICT);
        }

        Profile profile = new Profile();
        profile.setUserId(userId);
        profileRepository.save(profile);
        return toResponse(profile);
    }

    @Transactional(readOnly = true)
    public ProfileResponse getByUserId(UUID userId) {
        return profileRepository.findByUserId(userId)
                .map(this::toResponse)
                .orElseThrow(() -> new ResourceNotFoundException("Profile not found"));
    }

    /** Matches mobile About me / personal info ({@code MIN_PROFILE_AGE_YEARS}). */
    private static final int MIN_AGE_YEARS = 16;

    @Transactional
    public ProfileResponse update(UUID userId, UpdateProfileRequest request) {
        Profile profile = profileRepository.findByUserId(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Profile not found"));

        requireMinimumAge(request.dateOfBirth());

        profile.setFirstName(trimToNull(request.firstName()));
        profile.setLastName(trimToNull(request.lastName()));
        profile.setDateOfBirth(request.dateOfBirth());
        profile.setCountryOfResidence(request.countryOfResidence().trim().toUpperCase());
        profile.setStateTerritory(trimToNull(request.stateTerritory()));
        profile.setAddressLine1(trimToNull(request.addressLine1()));
        profile.setAddressLine2(trimToNull(request.addressLine2()));
        profile.setCity(trimToNull(request.city()));
        profile.setPostalCode(trimToNull(request.postalCode()));
        profile.setSourceOfIncome(trimToNull(request.sourceOfIncome()));
        profile.setMonthlyTransactionEstimate(trimToNull(request.monthlyTransactionEstimate()));

        profileRepository.save(profile);
        return toResponse(profile);
    }

    private ProfileResponse toResponse(Profile profile) {
        return new ProfileResponse(
                profile.getId(),
                profile.getUserId(),
                profile.getFirstName(),
                profile.getLastName(),
                profile.getDateOfBirth(),
                profile.getCountryOfResidence(),
                profile.getStateTerritory(),
                profile.getAddressLine1(),
                profile.getAddressLine2(),
                profile.getCity(),
                profile.getPostalCode(),
                profile.getSourceOfIncome(),
                profile.getMonthlyTransactionEstimate(),
                isComplete(profile));
    }

    static boolean isComplete(Profile profile) {
        return StringUtils.hasText(profile.getFirstName())
                && StringUtils.hasText(profile.getLastName())
                && profile.getDateOfBirth() != null
                && StringUtils.hasText(profile.getCountryOfResidence())
                && StringUtils.hasText(profile.getStateTerritory())
                && StringUtils.hasText(profile.getAddressLine1())
                && StringUtils.hasText(profile.getCity())
                && postalSatisfied(profile.getCountryOfResidence(), profile.getPostalCode())
                && StringUtils.hasText(profile.getSourceOfIncome())
                && StringUtils.hasText(profile.getMonthlyTransactionEstimate());
    }

    /** Matches mobile onboarding: NG/GH/KE do not require a real postal code. */
    static boolean postalSatisfied(String countryOfResidence, String postalCode) {
        if (StringUtils.hasText(postalCode)) {
            return true;
        }
        String cc = countryOfResidence == null ? "" : countryOfResidence.trim().toUpperCase();
        return cc.equals("NG") || cc.equals("GH") || cc.equals("KE");
    }

    private static void requireMinimumAge(LocalDate dateOfBirth) {
        if (dateOfBirth == null) {
            throw new BusinessException(
                    "PROFILE_AGE_REQUIRED", "Date of birth is required", HttpStatus.BAD_REQUEST);
        }
        LocalDate cutoff = LocalDate.now().minusYears(MIN_AGE_YEARS);
        if (dateOfBirth.isAfter(cutoff)) {
            throw new BusinessException(
                    "PROFILE_UNDERAGE",
                    "You must be at least " + MIN_AGE_YEARS + " years old",
                    HttpStatus.BAD_REQUEST);
        }
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
