package com.palpeer.admin.service;

import com.palpeer.admin.domain.AdminUser;
import com.palpeer.admin.repository.AdminUserRepository;
import com.palpeer.admin.web.dto.AdminUserSummaryResponse;
import com.palpeer.admin.web.dto.UpdateUserAdminRequest;
import com.palpeer.common.audit.AuditRecord;
import com.palpeer.common.audit.AuditRecorder;
import com.palpeer.common.exception.BusinessException;
import com.palpeer.common.exception.ResourceNotFoundException;
import com.palpeer.user.domain.User;
import com.palpeer.user.domain.UserStatus;
import com.palpeer.user.repository.UserRepository;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AdminUserService {

    private final UserRepository userRepository;
    private final AdminUserRepository adminUserRepository;
    private final AuditRecorder auditRecorder;

    @Transactional(readOnly = true)
    public Page<AdminUserSummaryResponse> listUsers(String email, UserStatus status, Pageable pageable) {
        return userRepository.findAll(filter(email, status), pageable).map(this::toSummary);
    }

    /** Excludes accounts linked to {@code admin_users}; operator accounts are managed under /admin/admins. */
    public static Specification<User> appUsersOnly() {
        return (root, query, cb) -> {
            Subquery<UUID> adminIds = query.subquery(UUID.class);
            Root<AdminUser> admin = adminIds.from(AdminUser.class);
            adminIds.select(admin.get("userId"));
            return cb.not(root.get("id").in(adminIds));
        };
    }

    @Transactional(readOnly = true)
    public boolean isAppUser(UUID userId) {
        return userRepository.existsById(userId) && !adminUserRepository.existsByUserId(userId);
    }

    private static Specification<User> filter(String email, UserStatus status) {
        return appUsersOnly().and((root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (email != null && !email.isBlank()) {
                predicates.add(cb.like(
                        cb.lower(root.get("email")),
                        "%" + escapeLike(email.trim().toLowerCase(Locale.ROOT)) + "%",
                        '\\'));
            }
            if (status != null) {
                predicates.add(cb.equal(root.get("status"), status));
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        });
    }

    static String escapeLike(String value) {
        return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }

    public AdminUserSummaryResponse summarize(User user) {
        return toSummary(user);
    }

    @Transactional(readOnly = true)
    public AdminUserSummaryResponse getUser(UUID userId) {
        return toSummary(requireUser(userId));
    }

    @Transactional
    public AdminUserSummaryResponse updateUser(UUID userId, UpdateUserAdminRequest request) {
        if (request.status() == null && request.enabled() == null) {
            throw new BusinessException(
                    "ADMIN_USER_NO_CHANGES",
                    "Provide status and/or enabled",
                    HttpStatus.BAD_REQUEST);
        }
        User user = requireUser(userId);
        String oldValue = "status=" + user.getStatus() + ";enabled=" + user.isEnabled();
        if (request.status() != null) {
            user.setStatus(request.status());
            if (request.status() == UserStatus.SUSPENDED || request.status() == UserStatus.CLOSED) {
                user.setEnabled(false);
            }
            if (request.status() == UserStatus.ACTIVE && request.enabled() == null) {
                user.setEnabled(true);
            }
        }
        if (request.enabled() != null) {
            user.setEnabled(request.enabled());
        }
        userRepository.save(user);
        auditRecorder.record(AuditRecord.builder("ADMIN_USER_UPDATE")
                .entity("User:" + userId)
                .userRef(userId)
                .oldValue(oldValue)
                .newValue("status=" + user.getStatus() + ";enabled=" + user.isEnabled())
                .build());
        return toSummary(user);
    }

    private User requireUser(UUID userId) {
        if (adminUserRepository.existsByUserId(userId)) {
            throw new ResourceNotFoundException("User not found");
        }
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
    }

    private AdminUserSummaryResponse toSummary(User user) {
        return new AdminUserSummaryResponse(
                user.getId(),
                user.getEmail(),
                user.getPhone(),
                user.getStatus(),
                user.isEnabled(),
                user.isEmailVerified(),
                user.isPhoneVerified(),
                user.getCreatedAt());
    }
}
