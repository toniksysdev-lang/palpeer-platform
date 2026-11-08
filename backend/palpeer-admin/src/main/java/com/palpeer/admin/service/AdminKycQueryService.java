package com.palpeer.admin.service;

import com.palpeer.kyc.domain.KycStatus;
import com.palpeer.kyc.service.KycService;
import com.palpeer.kyc.web.dto.AdminKycCaseDetailResponse;
import com.palpeer.kyc.web.dto.AdminKycCaseSummaryResponse;
import com.palpeer.kyc.web.dto.KycStatusResponse;
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

/** KYC list/detail for admin with email + first/last name from user/profile. */
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
        IdentityMaps maps = loadIdentity(userIds);

        return page.map(row -> {
            Profile profile = maps.profiles().get(row.userId());
            String firstName = blankToNull(profile == null ? null : profile.getFirstName());
            String lastName = blankToNull(profile == null ? null : profile.getLastName());
            return new AdminKycCaseSummaryResponse(
                    row.caseId(),
                    row.userId(),
                    maps.emails().get(row.userId()),
                    firstName,
                    lastName,
                    joinName(firstName, lastName),
                    row.status(),
                    row.rejectionReason(),
                    row.createdAt(),
                    row.updatedAt());
        });
    }

    @Transactional(readOnly = true)
    public AdminKycCaseDetailResponse getCase(UUID caseId) {
        return withIdentity(kycService.adminGetCase(caseId));
    }

    @Transactional(readOnly = true)
    public AdminKycCaseDetailResponse syncProvider(UUID caseId) {
        return withIdentity(kycService.adminSyncProvider(caseId));
    }

    private AdminKycCaseDetailResponse withIdentity(AdminKycCaseDetailResponse detail) {
        IdentityMaps maps = loadIdentity(List.of(detail.userId()));
        Profile profile = maps.profiles().get(detail.userId());
        return new AdminKycCaseDetailResponse(
                detail.caseId(),
                detail.userId(),
                maps.emails().get(detail.userId()),
                blankToNull(profile == null ? null : profile.getFirstName()),
                blankToNull(profile == null ? null : profile.getLastName()),
                detail.status(),
                detail.rejectionReason(),
                detail.createdAt(),
                detail.updatedAt(),
                detail.providerName(),
                detail.providerClientId(),
                detail.providerCheckId(),
                detail.providerCheckType(),
                detail.providerCheckStatus(),
                detail.providerOutcome(),
                detail.providerBreakdown(),
                detail.liveIdentityCheck(),
                detail.documents(),
                detail.selfie());
    }

    private IdentityMaps loadIdentity(List<UUID> userIds) {
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
        return new IdentityMaps(emails, profiles);
    }

    private static String joinName(String first, String last) {
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

    private record IdentityMaps(Map<UUID, String> emails, Map<UUID, Profile> profiles) {}
}
