package com.palpeer.profile.service;

import com.palpeer.common.exception.BusinessException;
import com.palpeer.common.exception.ResourceNotFoundException;
import com.palpeer.profile.domain.Profile;
import com.palpeer.profile.repository.ProfileRepository;
import com.palpeer.profile.web.dto.CreateProfileRequest;
import com.palpeer.profile.web.dto.ProfileResponse;
import com.palpeer.profile.web.dto.UpdateProfileRequest;
import com.palpeer.user.repository.UserRepository;
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

    @Transactional
    public ProfileResponse update(UUID userId, UpdateProfileRequest request) {
        Profile profile = profileRepository.findByUserId(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Profile not found"));

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
                && StringUtils.hasText(profile.getPostalCode())
                && StringUtils.hasText(profile.getSourceOfIncome())
                && StringUtils.hasText(profile.getMonthlyTransactionEstimate());
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
