package com.palpeer.wallet.service;

import com.palpeer.common.exception.ResourceNotFoundException;
import com.palpeer.user.domain.User;
import com.palpeer.user.repository.UserRepository;
import com.palpeer.wallet.domain.PlatformFeeRevenue;
import com.palpeer.wallet.domain.PlatformFeeSourceType;
import com.palpeer.wallet.repository.PlatformFeeRevenueRepository;
import com.palpeer.wallet.web.dto.PlatformFeeCurrencyTotal;
import com.palpeer.wallet.web.dto.PlatformFeeRevenueResponse;
import com.palpeer.wallet.web.dto.PlatformFeeSummaryResponse;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Tuple;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
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
public class PlatformFeeRevenueService {

    private final PlatformFeeRevenueRepository platformFeeRevenueRepository;
    private final UserRepository userRepository;
    private final EntityManager entityManager;

    /**
     * Persist platform fee revenue once per (source, reference). Safe to call again on settlement replay.
     */
    @Transactional
    public void record(
            PlatformFeeSourceType sourceType,
            String referenceType,
            UUID referenceId,
            UUID userId,
            String currencyCode,
            BigDecimal amount,
            String description) {
        if (amount == null || amount.signum() <= 0) {
            return;
        }
        if (platformFeeRevenueRepository.existsBySourceTypeAndReferenceTypeAndReferenceId(
                sourceType, referenceType, referenceId)) {
            return;
        }
        PlatformFeeRevenue row = new PlatformFeeRevenue();
        row.setSourceType(sourceType);
        row.setReferenceType(referenceType);
        row.setReferenceId(referenceId);
        row.setUserId(userId);
        row.setCurrencyCode(normalizeCurrency(currencyCode));
        row.setAmount(amount);
        row.setDescription(trimToNull(description));
        platformFeeRevenueRepository.save(row);
    }

    @Transactional(readOnly = true)
    public Page<PlatformFeeRevenueResponse> search(
            PlatformFeeSourceType sourceType,
            String currencyCode,
            String q,
            Instant from,
            Instant to,
            Pageable pageable) {
        Pageable sorted = PageRequest.of(
                pageable.getPageNumber(),
                pageable.getPageSize(),
                pageable.getSort().isSorted() ? pageable.getSort() : Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<PlatformFeeRevenue> page =
                platformFeeRevenueRepository.findAll(filter(sourceType, currencyCode, q, from, to), sorted);
        Map<UUID, String> emails = resolveUserEmails(page.getContent());
        return page.map(row -> toResponse(row, emails));
    }

    @Transactional(readOnly = true)
    public PlatformFeeRevenueResponse getById(UUID id) {
        PlatformFeeRevenue row = platformFeeRevenueRepository
                .findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Platform fee revenue not found"));
        Map<UUID, String> emails = resolveUserEmails(List.of(row));
        return toResponse(row, emails);
    }

    public static final int EXPORT_MAX_ROWS = 5_000;

    /** Same filters as {@link #search}, newest first, capped at {@link #EXPORT_MAX_ROWS}. */
    @Transactional(readOnly = true)
    public List<PlatformFeeRevenueResponse> export(
            PlatformFeeSourceType sourceType,
            String currencyCode,
            String q,
            Instant from,
            Instant to) {
        Pageable pageable = PageRequest.of(0, EXPORT_MAX_ROWS, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<PlatformFeeRevenue> page =
                platformFeeRevenueRepository.findAll(filter(sourceType, currencyCode, q, from, to), pageable);
        Map<UUID, String> emails = resolveUserEmails(page.getContent());
        return page.getContent().stream().map(row -> toResponse(row, emails)).toList();
    }

    /**
     * Currency totals for dashboard cards. Applies currency / search / date filters; sourceType is
     * ignored so Grand / P2P / InstantEX cards always reflect the full filtered window.
     */
    @Transactional(readOnly = true)
    public PlatformFeeSummaryResponse summarize(String currencyCode, String q, Instant from, Instant to) {
        CriteriaBuilder cb = entityManager.getCriteriaBuilder();
        CriteriaQuery<Tuple> cq = cb.createTupleQuery();
        Root<PlatformFeeRevenue> root = cq.from(PlatformFeeRevenue.class);
        cq.multiselect(
                root.get("sourceType"),
                root.get("currencyCode"),
                cb.sum(root.get("amount")),
                cb.count(root));
        Predicate where = filter(null, currencyCode, q, from, to).toPredicate(root, cq, cb);
        if (where != null) {
            cq.where(where);
        }
        cq.groupBy(root.get("sourceType"), root.get("currencyCode"));

        List<PlatformFeeCurrencyTotal> p2p = new ArrayList<>();
        List<PlatformFeeCurrencyTotal> instantEx = new ArrayList<>();
        Map<String, PlatformFeeCurrencyTotal> grandByCurrency = new HashMap<>();

        for (Tuple tuple : entityManager.createQuery(cq).getResultList()) {
            PlatformFeeSourceType source = tuple.get(0, PlatformFeeSourceType.class);
            String currency = tuple.get(1, String.class);
            BigDecimal amount = tuple.get(2, BigDecimal.class);
            Long count = tuple.get(3, Long.class);
            if (currency == null || amount == null) {
                continue;
            }
            long rowCount = count == null ? 0L : count;
            PlatformFeeCurrencyTotal line = new PlatformFeeCurrencyTotal(currency, amount, rowCount);
            if (source == PlatformFeeSourceType.P2P) {
                p2p.add(line);
            } else if (source == PlatformFeeSourceType.INSTANT_EX) {
                instantEx.add(line);
            }
            grandByCurrency.merge(currency, line, (a, b) -> new PlatformFeeCurrencyTotal(
                    currency,
                    a.amount().add(b.amount()),
                    a.count() + b.count()));
        }

        Comparator<PlatformFeeCurrencyTotal> byCurrency =
                Comparator.comparing(PlatformFeeCurrencyTotal::currencyCode);
        List<PlatformFeeCurrencyTotal> grand = new ArrayList<>(grandByCurrency.values());
        grand.sort(byCurrency);
        p2p.sort(byCurrency);
        instantEx.sort(byCurrency);
        return new PlatformFeeSummaryResponse(grand, p2p, instantEx);
    }

    private Map<UUID, String> resolveUserEmails(List<PlatformFeeRevenue> rows) {
        Set<UUID> userIds = new HashSet<>();
        for (PlatformFeeRevenue row : rows) {
            userIds.add(row.getUserId());
        }
        Map<UUID, String> emails = new HashMap<>();
        if (userIds.isEmpty()) {
            return emails;
        }
        for (User user : userRepository.findAllById(userIds)) {
            emails.put(user.getId(), user.getEmail());
        }
        return emails;
    }

    private static Specification<PlatformFeeRevenue> filter(
            PlatformFeeSourceType sourceType, String currencyCode, String q, Instant from, Instant to) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (sourceType != null) {
                predicates.add(cb.equal(root.get("sourceType"), sourceType));
            }
            if (currencyCode != null && !currencyCode.isBlank()) {
                predicates.add(cb.equal(
                        cb.upper(root.get("currencyCode")), currencyCode.trim().toUpperCase(Locale.ROOT)));
            }
            if (from != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("createdAt"), from));
            }
            if (to != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("createdAt"), to));
            }
            if (q != null && !q.isBlank()) {
                String needle = "%" + q.trim().toLowerCase(Locale.ROOT) + "%";
                List<Predicate> search = new ArrayList<>();
                search.add(cb.like(cb.lower(root.get("description")), needle));
                search.add(cb.like(cb.lower(root.get("referenceType")), needle));
                search.add(cb.like(cb.lower(root.get("currencyCode")), needle));
                try {
                    UUID refId = UUID.fromString(q.trim());
                    search.add(cb.equal(root.get("referenceId"), refId));
                    search.add(cb.equal(root.get("userId"), refId));
                } catch (IllegalArgumentException ignored) {
                    // not a UUID — text search only
                }
                predicates.add(cb.or(search.toArray(Predicate[]::new)));
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };
    }

    private PlatformFeeRevenueResponse toResponse(PlatformFeeRevenue row, Map<UUID, String> emails) {
        return new PlatformFeeRevenueResponse(
                row.getId(),
                row.getSourceType(),
                row.getReferenceType(),
                row.getReferenceId(),
                row.getUserId(),
                emails.get(row.getUserId()),
                row.getCurrencyCode(),
                row.getAmount(),
                row.getDescription(),
                row.getCreatedAt());
    }

    private static String normalizeCurrency(String code) {
        return code.trim().toUpperCase(Locale.ROOT);
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
