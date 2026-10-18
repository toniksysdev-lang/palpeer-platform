package com.palpeer.admin.service;

import com.palpeer.admin.domain.AdminUser;
import com.palpeer.admin.repository.AdminUserRepository;
import com.palpeer.admin.web.dto.AdminUserSummaryResponse;
import com.palpeer.admin.web.dto.UpdateUserAdminRequest;
import com.palpeer.common.audit.AuditRecord;
import com.palpeer.common.audit.AuditRecorder;
import com.palpeer.common.exception.BusinessException;
import com.palpeer.common.exception.ResourceNotFoundException;
import com.palpeer.common.storage.ObjectStorage;
import com.palpeer.user.domain.User;
import com.palpeer.user.domain.UserStatus;
import com.palpeer.user.repository.UserRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class AdminUserService {

    private final UserRepository userRepository;
    private final AdminUserRepository adminUserRepository;
    private final AuditRecorder auditRecorder;
    private final ObjectStorage objectStorage;
    private final EntityManager entityManager;

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

    /**
     * Permanently deletes an app user and every related row (auth, profile, wallets, KYC,
     * P2P/chat/negotiation participation, cards, promotions, notes, etc.). Operator accounts
     * linked in {@code admin_users} are rejected.
     */
    @Transactional
    public void deleteUser(UUID userId) {
        User user = requireUser(userId);
        String email = user.getEmail();
        List<String> storageKeys = collectKycStorageKeys(userId);

        // Chat (rooms the user participates in, or rooms tied to their P2P orders)
        exec(
                """
                DELETE FROM chat_messages
                WHERE sender_id = :userId
                   OR room_id IN (
                        SELECT id FROM chat_rooms
                        WHERE participant_a_id = :userId
                           OR participant_b_id = :userId
                           OR p2p_order_id IN (
                                SELECT id FROM p2p_orders
                                WHERE requester_id = :userId OR acceptor_id = :userId
                                   OR request_id IN (SELECT id FROM p2p_requests WHERE user_id = :userId)
                           )
                   )
                """,
                userId);
        exec(
                """
                DELETE FROM chat_rooms
                WHERE participant_a_id = :userId
                   OR participant_b_id = :userId
                   OR p2p_order_id IN (
                        SELECT id FROM p2p_orders
                        WHERE requester_id = :userId OR acceptor_id = :userId
                           OR request_id IN (SELECT id FROM p2p_requests WHERE user_id = :userId)
                   )
                """,
                userId);

        // Negotiations (break circular current_offer FK first)
        exec(
                """
                UPDATE negotiations SET current_offer_id = NULL
                WHERE requester_id = :userId
                   OR counterparty_id = :userId
                   OR closed_by = :userId
                   OR p2p_request_id IN (SELECT id FROM p2p_requests WHERE user_id = :userId)
                   OR id IN (
                        SELECT negotiation_id FROM negotiation_offers WHERE offered_by = :userId
                   )
                """,
                userId);
        exec(
                """
                DELETE FROM negotiation_offers
                WHERE offered_by = :userId
                   OR negotiation_id IN (
                        SELECT id FROM negotiations
                        WHERE requester_id = :userId
                           OR counterparty_id = :userId
                           OR closed_by = :userId
                           OR p2p_request_id IN (SELECT id FROM p2p_requests WHERE user_id = :userId)
                   )
                """,
                userId);
        exec(
                """
                DELETE FROM negotiations
                WHERE requester_id = :userId
                   OR counterparty_id = :userId
                   OR closed_by = :userId
                   OR p2p_request_id IN (SELECT id FROM p2p_requests WHERE user_id = :userId)
                """,
                userId);

        // P2P
        exec(
                """
                DELETE FROM p2p_orders
                WHERE requester_id = :userId
                   OR acceptor_id = :userId
                   OR request_id IN (SELECT id FROM p2p_requests WHERE user_id = :userId)
                """,
                userId);
        exec("DELETE FROM p2p_requests WHERE user_id = :userId", userId);

        // Cards / FX / money movement (before wallets)
        exec(
                """
                DELETE FROM card_transactions
                WHERE user_id = :userId
                   OR card_id IN (SELECT id FROM cards WHERE user_id = :userId)
                """,
                userId);
        exec("DELETE FROM cards WHERE user_id = :userId", userId);
        exec("DELETE FROM exchange_transactions WHERE user_id = :userId", userId);
        exec("DELETE FROM exchange_quotes WHERE user_id = :userId", userId);
        exec("DELETE FROM funding_transactions WHERE user_id = :userId", userId);
        exec("DELETE FROM withdrawal_transactions WHERE user_id = :userId", userId);
        exec(
                """
                DELETE FROM wallet_transfers
                WHERE sender_user_id = :userId OR recipient_user_id = :userId
                """,
                userId);
        exec("DELETE FROM payment_virtual_accounts WHERE user_id = :userId", userId);

        // Ledger + wallets
        exec(
                """
                DELETE FROM ledger_entries
                WHERE wallet_id IN (SELECT id FROM wallets WHERE user_id = :userId)
                """,
                userId);
        exec("DELETE FROM wallets WHERE user_id = :userId", userId);

        // KYC
        exec(
                """
                DELETE FROM kyc_documents
                WHERE kyc_case_id IN (SELECT id FROM kyc_cases WHERE user_id = :userId)
                """,
                userId);
        exec(
                """
                DELETE FROM kyc_selfies
                WHERE kyc_case_id IN (SELECT id FROM kyc_cases WHERE user_id = :userId)
                """,
                userId);
        exec("DELETE FROM kyc_cases WHERE user_id = :userId", userId);

        // Promotions / notifications / security / profile / auth / notes
        exec("DELETE FROM bonuses WHERE user_id = :userId", userId);
        exec(
                """
                DELETE FROM referrals
                WHERE referrer_user_id = :userId OR referee_user_id = :userId
                """,
                userId);
        exec("DELETE FROM notifications WHERE user_id = :userId", userId);
        exec("DELETE FROM device_tokens WHERE user_id = :userId", userId);
        exec("DELETE FROM devices WHERE user_id = :userId", userId);
        exec("DELETE FROM security_questions WHERE user_id = :userId", userId);
        exec("DELETE FROM pin_credentials WHERE user_id = :userId", userId);
        exec("DELETE FROM profiles WHERE user_id = :userId", userId);
        exec("DELETE FROM otp_challenges WHERE user_id = :userId", userId);
        exec("DELETE FROM refresh_tokens WHERE user_id = :userId", userId);
        exec(
                """
                DELETE FROM admin_user_notes
                WHERE user_id = :userId OR author_user_id = :userId
                """,
                userId);
        entityManager
                .createNativeQuery(
                        """
                        DELETE FROM audit_logs
                        WHERE user_ref = :userRef OR entity = :entity
                        """)
                .setParameter("userRef", userId.toString())
                .setParameter("entity", "User:" + userId)
                .executeUpdate();

        userRepository.delete(user);
        entityManager.flush();

        for (String key : storageKeys) {
            try {
                objectStorage.delete(key);
            } catch (RuntimeException ex) {
                log.warn("KYC object cleanup failed after user delete [userId={}, key={}]: {}",
                        userId, key, ex.getMessage());
            }
        }

        auditRecorder.record(AuditRecord.builder("ADMIN_USER_DELETE")
                .entity("User:" + userId)
                .userRef(userId)
                .oldValue("email=" + email)
                .newValue("purged")
                .build());
    }

    @SuppressWarnings("unchecked")
    private List<String> collectKycStorageKeys(UUID userId) {
        return entityManager
                .createNativeQuery(
                        """
                        SELECT storage_key FROM kyc_documents
                        WHERE kyc_case_id IN (SELECT id FROM kyc_cases WHERE user_id = :userId)
                        UNION ALL
                        SELECT storage_key FROM kyc_selfies
                        WHERE kyc_case_id IN (SELECT id FROM kyc_cases WHERE user_id = :userId)
                        """)
                .setParameter("userId", userId)
                .getResultList();
    }

    private void exec(String sql, UUID userId) {
        entityManager.createNativeQuery(sql).setParameter("userId", userId).executeUpdate();
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
