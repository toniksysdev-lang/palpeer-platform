package com.palpeer.audit.service;

import com.palpeer.audit.web.dto.AuditLogResponse;
import com.palpeer.common.domain.AuditEntity;
import com.palpeer.common.domain.AuditEntityRepository;
import com.palpeer.user.domain.User;
import com.palpeer.user.repository.UserRepository;
import jakarta.persistence.criteria.Predicate;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AuditQueryService {

    private final AuditEntityRepository auditEntityRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public Page<AuditLogResponse> search(
            String userRef,
            String action,
            String entity,
            Instant from,
            Instant to,
            Pageable pageable) {
        Pageable sorted = PageRequest.of(
                pageable.getPageNumber(),
                pageable.getPageSize(),
                pageable.getSort().isSorted() ? pageable.getSort() : Sort.by(Sort.Direction.DESC, "createdAt"));

        // Allow filtering actor by email as well as raw userRef / user id.
        String resolvedUserRef = userRef;
        if (userRef != null && !userRef.isBlank() && userRef.contains("@")) {
            resolvedUserRef = userRepository
                    .findByEmailIgnoreCase(userRef.trim())
                    .map(user -> user.getId().toString())
                    .orElse(userRef.trim());
        }

        Page<AuditEntity> page =
                auditEntityRepository.findAll(filter(resolvedUserRef, action, entity, from, to), sorted);
        Map<String, String> emailsByUserRef = resolveEmails(page.getContent());
        return page.map(entityRow -> toResponse(entityRow, emailsByUserRef));
    }

    private Map<String, String> resolveEmails(List<AuditEntity> rows) {
        Set<UUID> ids = new HashSet<>();
        for (AuditEntity row : rows) {
            UUID id = parseUuid(row.getUserRef());
            if (id != null) {
                ids.add(id);
            }
        }
        Map<String, String> emails = new HashMap<>();
        if (ids.isEmpty()) {
            return emails;
        }
        for (User user : userRepository.findAllById(ids)) {
            emails.put(user.getId().toString(), user.getEmail());
        }
        return emails;
    }

    private static UUID parseUuid(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return UUID.fromString(value.trim());
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    private static Specification<AuditEntity> filter(
            String userRef,
            String action,
            String entity,
            Instant from,
            Instant to) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (userRef != null && !userRef.isBlank()) {
                predicates.add(cb.equal(root.get("userRef"), userRef.trim()));
            }
            if (action != null && !action.isBlank()) {
                predicates.add(cb.equal(root.get("action"), action));
            }
            if (entity != null && !entity.isBlank()) {
                predicates.add(cb.equal(root.get("entity"), entity));
            }
            if (from != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("createdAt"), from));
            }
            if (to != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("createdAt"), to));
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };
    }

    private AuditLogResponse toResponse(AuditEntity a, Map<String, String> emailsByUserRef) {
        String ref = a.getUserRef();
        String email = ref == null ? null : emailsByUserRef.get(ref);
        if (email == null && ref != null && ref.contains("@")) {
            email = ref;
        }
        return new AuditLogResponse(
                a.getId(),
                a.getCreatedAt(),
                a.getUserRef(),
                email,
                a.getAction(),
                a.getEntity(),
                a.getOldValue(),
                a.getNewValue(),
                a.getIpAddress(),
                a.getDevice());
    }
}
