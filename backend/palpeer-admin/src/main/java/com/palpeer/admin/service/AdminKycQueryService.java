package com.palpeer.admin.service;

import com.palpeer.kyc.service.KycService;
import com.palpeer.kyc.web.dto.AdminKycCaseSummaryResponse;
import com.palpeer.kyc.web.dto.KycStatusResponse;
import com.palpeer.kyc.domain.KycStatus;
import com.palpeer.profile.domain.Profile;
import com.palpeer.profile.repository.ProfileRepository;
import com.palpeer.user.domain.User;
import com.palpeer.user.repository.UserRepository;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** KYC list for admin with email + full name from user/profile. */
@Service
@RequiredArgsConstructor
public class AdminKycQueryService {

    private final KycService kycService;
    private final UserRepository userRepository;
    private final ProfileRepository profileRepository;

    @Transactional(readOnly = true)
    public Page<AdminKycCaseSummaryResponse> listCases(KycStatus status, UUID userId, Pageable pageable) {
        Page<KycStatusResponse> page = kycService.listCases(status, userId, pageable);
        List<UUID> userIds = page.getContent().stream().map(KycStatusResponse::userId).distinct().toList();
        Map<UUID, String> emails = new HashMap<>();
        if (!userIds.isEmpty()) {
            for (User user : userRepository.findAllById(userIds)) {
                emails.put(user.getId(), user.getEmail());
            }
        }
        Map<UUID, Profile> profiles = userIds.isEmpty()
                ? Map.of()
                : profileRepository.findByUserIdIn(userIds).stream()
                        .collect(Collectors.toMap(Profile::getUserId, p -> p, (a, b) -> a));

        return page.map(row -> {
            Profile profile = profiles.get(row.userId());
            String fullName = fullName(profile);
            return new AdminKycCaseSummaryResponse(
                    row.caseId(),
                    row.userId(),
                    emails.get(row.userId()),
                    fullName,
                    row.status(),
                    row.rejectionReason(),
                    row.createdAt(),
                    row.updatedAt());
        });
    }

    private static String fullName(Profile profile) {
        if (profile == null) {
            return null;
        }
        String first = blankToNull(profile.getFirstName());
        String last = blankToNull(profile.getLastName());
        if (first == null && last == null) {
            return null;
        }
        if (first == null) {
            return last;
        }
        if (last == null) {
            return first;
        }
        return first + " " + last;
    }

    private static String blankToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }
}
