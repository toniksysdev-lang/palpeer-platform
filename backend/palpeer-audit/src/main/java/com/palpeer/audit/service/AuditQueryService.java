package com.palpeer.audit.service;

import com.palpeer.audit.web.dto.AuditLogResponse;
import com.palpeer.common.domain.AuditEntity;
import com.palpeer.common.domain.AuditEntityRepository;
import jakarta.persistence.criteria.Predicate;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
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
        return auditEntityRepository.findAll(filter(userRef, action, entity, from, to), sorted)
                .map(this::toResponse);
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
                predicates.add(cb.equal(root.get("userRef"), userRef));
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

    private AuditLogResponse toResponse(AuditEntity a) {
        return new AuditLogResponse(
                a.getId(),
                a.getCreatedAt(),
                a.getUserRef(),
                a.getAction(),
                a.getEntity(),
                a.getOldValue(),
                a.getNewValue(),
                a.getIpAddress(),
                a.getDevice());
    }
}
