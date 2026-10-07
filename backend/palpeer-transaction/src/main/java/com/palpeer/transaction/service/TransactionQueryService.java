package com.palpeer.transaction.service;

import com.palpeer.common.exception.ResourceNotFoundException;
import com.palpeer.exchange.domain.ExchangeTransaction;
import com.palpeer.exchange.domain.ExchangeTransactionStatus;
import com.palpeer.exchange.repository.ExchangeTransactionRepository;
import com.palpeer.transaction.domain.TransactionActivityType;
import com.palpeer.transaction.web.dto.TransactionItemResponse;
import com.palpeer.transaction.web.dto.TransactionPageResponse;
import com.palpeer.transaction.web.dto.TransactionSummaryResponse;
import com.palpeer.transaction.web.dto.TransactionSummaryResponse.CurrencyAmountTotal;
import com.palpeer.wallet.domain.Wallet;
import com.palpeer.wallet.funding.FundingTransaction;
import com.palpeer.wallet.funding.FundingTransactionRepository;
import com.palpeer.wallet.funding.MoneyMovementStatus;
import com.palpeer.wallet.repository.WalletRepository;
import com.palpeer.wallet.withdrawal.WithdrawalTransaction;
import com.palpeer.wallet.withdrawal.WithdrawalTransactionRepository;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Stream;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Read-only facade over ledger-backed product transactions.
 * Does not invent settlement; P2P excluded until ledger-wired (P11-01).
 */
@Service
@RequiredArgsConstructor
public class TransactionQueryService {

    public static final int DEFAULT_RECENT_LIMIT = 20;
    public static final int MAX_RECENT_LIMIT = 100;
    /** CONTRACT_PENDING (P11-04): default summary window. */
    public static final int DEFAULT_SUMMARY_DAYS = 30;
    public static final int ADMIN_EXPORT_MAX_ROWS = 5_000;
    /** Upper bound on rows fetched per source for one admin page (deep pages beyond this return empty). */
    public static final int ADMIN_MAX_FETCH_PER_SOURCE = 10_000;

    private final FundingTransactionRepository fundingRepository;
    private final WithdrawalTransactionRepository withdrawalRepository;
    private final ExchangeTransactionRepository exchangeRepository;
    private final WalletRepository walletRepository;

    @Transactional(readOnly = true)
    public List<TransactionItemResponse> recent(UUID userId, int limit) {
        int size = Math.min(Math.max(limit, 1), MAX_RECENT_LIMIT);
        PageRequest page = PageRequest.of(0, size);

        List<TransactionItemResponse> merged = Stream.of(
                        fundingRepository.findByUserIdOrderByCreatedAtDesc(userId, page).stream().map(this::fromFunding),
                        withdrawalRepository.findByUserIdOrderByCreatedAtDesc(userId, page).stream().map(this::fromWithdrawal),
                        exchangeRepository.findByUserIdOrderByCreatedAtDesc(userId, page).stream().map(this::fromExchange))
                .flatMap(s -> s)
                .sorted(Comparator.comparing(TransactionItemResponse::createdAt).reversed())
                .limit(size)
                .toList();
        return merged;
    }

    @Transactional(readOnly = true)
    public TransactionItemResponse details(UUID userId, TransactionActivityType type, UUID id) {
        return switch (type) {
            case FUNDING -> fundingRepository.findByIdAndUserId(id, userId)
                    .map(this::fromFunding)
                    .orElseThrow(() -> new ResourceNotFoundException("Funding transaction not found"));
            case WITHDRAWAL -> withdrawalRepository.findByIdAndUserId(id, userId)
                    .map(this::fromWithdrawal)
                    .orElseThrow(() -> new ResourceNotFoundException("Withdrawal transaction not found"));
            case EXCHANGE -> exchangeRepository.findByIdAndUserId(id, userId)
                    .map(this::fromExchange)
                    .orElseThrow(() -> new ResourceNotFoundException("Exchange transaction not found"));
        };
    }

    /**
     * CONTRACT_PENDING (P11-03): cross-source pagination merges in memory (bounded fetch).
     */
    @Transactional(readOnly = true)
    public TransactionPageResponse history(
            UUID userId,
            TransactionActivityType typeFilter,
            Instant from,
            Instant to,
            int page,
            int size) {
        Instant rangeFrom = from != null ? from : Instant.EPOCH;
        Instant rangeTo = to != null ? to : Instant.now().plus(1, ChronoUnit.DAYS);
        int safePage = Math.max(page, 0);
        int safeSize = Math.min(Math.max(size, 1), MAX_RECENT_LIMIT);
        int fetch = (safePage + 1) * safeSize;

        List<TransactionItemResponse> candidates = new ArrayList<>();
        PageRequest fetchPage = PageRequest.of(0, fetch);

        if (typeFilter == null || typeFilter == TransactionActivityType.FUNDING) {
            fundingRepository
                    .findByUserIdAndCreatedAtGreaterThanEqualAndCreatedAtLessThanEqualOrderByCreatedAtDesc(
                            userId, rangeFrom, rangeTo, fetchPage)
                    .forEach(f -> candidates.add(fromFunding(f)));
        }
        if (typeFilter == null || typeFilter == TransactionActivityType.WITHDRAWAL) {
            withdrawalRepository
                    .findByUserIdAndCreatedAtGreaterThanEqualAndCreatedAtLessThanEqualOrderByCreatedAtDesc(
                            userId, rangeFrom, rangeTo, fetchPage)
                    .forEach(w -> candidates.add(fromWithdrawal(w)));
        }
        if (typeFilter == null || typeFilter == TransactionActivityType.EXCHANGE) {
            exchangeRepository
                    .findByUserIdAndCreatedAtGreaterThanEqualAndCreatedAtLessThanEqualOrderByCreatedAtDesc(
                            userId, rangeFrom, rangeTo, fetchPage)
                    .forEach(e -> candidates.add(fromExchange(e)));
        }

        List<TransactionItemResponse> sorted = candidates.stream()
                .sorted(Comparator.comparing(TransactionItemResponse::createdAt).reversed())
                .toList();

        long totalElements = countInRange(userId, typeFilter, rangeFrom, rangeTo);
        int fromIndex = Math.min(safePage * safeSize, sorted.size());
        int toIndex = Math.min(fromIndex + safeSize, sorted.size());
        List<TransactionItemResponse> slice = sorted.subList(fromIndex, toIndex);
        int totalPages = safeSize == 0 ? 0 : (int) Math.ceil((double) totalElements / safeSize);

        return new TransactionPageResponse(slice, safePage, safeSize, totalElements, totalPages);
    }

    @Transactional(readOnly = true)
    public TransactionSummaryResponse summary(UUID userId, Instant from, Instant to) {
        Instant rangeTo = to != null ? to : Instant.now();
        Instant rangeFrom = from != null ? from : rangeTo.minus(DEFAULT_SUMMARY_DAYS, ChronoUnit.DAYS);

        List<FundingTransaction> fundings = fundingRepository
                .findByUserIdAndCreatedAtGreaterThanEqualAndCreatedAtLessThanEqual(userId, rangeFrom, rangeTo);
        List<WithdrawalTransaction> withdrawals = withdrawalRepository
                .findByUserIdAndCreatedAtGreaterThanEqualAndCreatedAtLessThanEqual(userId, rangeFrom, rangeTo);
        List<ExchangeTransaction> exchanges = exchangeRepository
                .findByUserIdAndCreatedAtGreaterThanEqualAndCreatedAtLessThanEqual(userId, rangeFrom, rangeTo);

        Map<String, Long> countByType = new LinkedHashMap<>();
        countByType.put(TransactionActivityType.FUNDING.name(), (long) fundings.size());
        countByType.put(TransactionActivityType.WITHDRAWAL.name(), (long) withdrawals.size());
        countByType.put(TransactionActivityType.EXCHANGE.name(), (long) exchanges.size());

        Map<String, Long> countByStatus = new LinkedHashMap<>();
        // Namespace by type so MoneyMovementStatus and ExchangeTransactionStatus do not collide (P11-04)
        fundings.forEach(f -> countByStatus.merge("FUNDING:" + f.getStatus().name(), 1L, Long::sum));
        withdrawals.forEach(w -> countByStatus.merge("WITHDRAWAL:" + w.getStatus().name(), 1L, Long::sum));
        exchanges.forEach(e -> countByStatus.merge("EXCHANGE:" + e.getStatus().name(), 1L, Long::sum));

        Map<String, CurrencyAccumulator> fundingTotals = new HashMap<>();
        for (FundingTransaction f : fundings) {
            if (f.getStatus() == MoneyMovementStatus.SUCCESS) {
                fundingTotals.computeIfAbsent(f.getCurrencyCode(), CurrencyAccumulator::new)
                        .add(f.getAmount());
            }
        }
        Map<String, CurrencyAccumulator> withdrawalTotals = new HashMap<>();
        for (WithdrawalTransaction w : withdrawals) {
            if (w.getStatus() == MoneyMovementStatus.SUCCESS) {
                withdrawalTotals.computeIfAbsent(w.getCurrencyCode(), CurrencyAccumulator::new)
                        .add(w.getAmount());
            }
        }

        long successfulExchangeCount = exchanges.stream()
                .filter(e -> e.getStatus() == ExchangeTransactionStatus.SUCCESS)
                .count();

        long total = fundings.size() + withdrawals.size() + exchanges.size();

        return new TransactionSummaryResponse(
                rangeFrom,
                rangeTo,
                total,
                Map.copyOf(countByType),
                Map.copyOf(countByStatus),
                toTotals(fundingTotals),
                toTotals(withdrawalTotals),
                successfulExchangeCount);
    }

    /**
     * Cross-user feed for admin (P15). Same merge rules as user history.
     */
    @Transactional(readOnly = true)
    public TransactionPageResponse adminHistory(
            UUID targetUserId,
            TransactionActivityType typeFilter,
            Instant from,
            Instant to,
            int page,
            int size) {
        return history(targetUserId, typeFilter, from, to, page, size);
    }

    @Transactional(readOnly = true)
    public List<TransactionItemResponse> adminRecent(UUID targetUserId, int limit) {
        return recent(targetUserId, limit);
    }

    /**
     * Admin global feed across all users. Each source is fetched newest-first with a bounded
     * window (page*size+size, capped), merged by createdAt desc; totals come from per-source counts.
     */
    @Transactional(readOnly = true)
    public TransactionPageResponse adminSearch(AdminTransactionFilter filter, int page, int size) {
        int safePage = Math.max(page, 0);
        int safeSize = Math.min(Math.max(size, 1), MAX_RECENT_LIMIT);
        long needed = (long) safePage * safeSize + safeSize;
        int fetch = (int) Math.min(needed, ADMIN_MAX_FETCH_PER_SOURCE);

        List<TransactionItemResponse> sorted = adminFetch(filter, fetch);
        long totalElements = adminCount(filter);

        int fromIndex = (int) Math.min((long) safePage * safeSize, sorted.size());
        int toIndex = Math.min(fromIndex + safeSize, sorted.size());
        int totalPages = (int) Math.ceil((double) totalElements / safeSize);
        return new TransactionPageResponse(
                List.copyOf(sorted.subList(fromIndex, toIndex)), safePage, safeSize, totalElements, totalPages);
    }

    /** Admin export: same filters as {@link #adminSearch}, newest first, capped at {@link #ADMIN_EXPORT_MAX_ROWS}. */
    @Transactional(readOnly = true)
    public List<TransactionItemResponse> adminExport(AdminTransactionFilter filter) {
        return adminFetch(filter, ADMIN_EXPORT_MAX_ROWS).stream()
                .limit(ADMIN_EXPORT_MAX_ROWS)
                .toList();
    }

    /** Admin detail by type and id, without owner check. */
    @Transactional(readOnly = true)
    public TransactionItemResponse adminDetails(TransactionActivityType type, UUID id) {
        return switch (type) {
            case FUNDING -> fundingRepository.findById(id)
                    .map(this::fromFunding)
                    .orElseThrow(() -> new ResourceNotFoundException("Funding transaction not found"));
            case WITHDRAWAL -> withdrawalRepository.findById(id)
                    .map(this::fromWithdrawal)
                    .orElseThrow(() -> new ResourceNotFoundException("Withdrawal transaction not found"));
            case EXCHANGE -> exchangeRepository.findById(id)
                    .map(this::fromExchange)
                    .orElseThrow(() -> new ResourceNotFoundException("Exchange transaction not found"));
        };
    }

    private List<TransactionItemResponse> adminFetch(AdminTransactionFilter filter, int fetch) {
        PageRequest window = PageRequest.of(0, fetch, Sort.by(Sort.Direction.DESC, "createdAt"));
        List<TransactionItemResponse> candidates = new ArrayList<>();
        AdminSources sources = AdminSources.of(filter);

        if (sources.funding()) {
            fundingRepository.findAll(movementSpec(filter, sources.movementStatus()), window)
                    .forEach(f -> candidates.add(fromFunding(f)));
        }
        if (sources.withdrawal()) {
            withdrawalRepository.findAll(movementSpec(filter, sources.movementStatus()), window)
                    .forEach(w -> candidates.add(fromWithdrawal(w)));
        }
        if (sources.exchange()) {
            List<ExchangeTransaction> exchanges = exchangeRepository
                    .findAll(exchangeSpec(filter, sources.exchangeStatus()), window)
                    .getContent();
            Map<UUID, String> currencies = walletCurrencies(exchanges);
            exchanges.forEach(e -> candidates.add(fromExchange(e, currencies::get)));
        }

        return candidates.stream()
                .sorted(Comparator.comparing(TransactionItemResponse::createdAt).reversed())
                .toList();
    }

    private long adminCount(AdminTransactionFilter filter) {
        AdminSources sources = AdminSources.of(filter);
        long total = 0;
        if (sources.funding()) {
            total += fundingRepository.count(movementSpec(filter, sources.movementStatus()));
        }
        if (sources.withdrawal()) {
            total += withdrawalRepository.count(movementSpec(filter, sources.movementStatus()));
        }
        if (sources.exchange()) {
            total += exchangeRepository.count(exchangeSpec(filter, sources.exchangeStatus()));
        }
        return total;
    }

    private Map<UUID, String> walletCurrencies(List<ExchangeTransaction> exchanges) {
        Set<UUID> ids = new HashSet<>();
        for (ExchangeTransaction e : exchanges) {
            ids.add(e.getSourceWalletId());
            ids.add(e.getTargetWalletId());
        }
        Map<UUID, String> currencies = new HashMap<>();
        if (!ids.isEmpty()) {
            walletRepository.findAllById(ids).forEach(w -> currencies.put(w.getId(), w.getCurrencyCode()));
        }
        return currencies;
    }

    private static <T> Specification<T> movementSpec(AdminTransactionFilter filter, MoneyMovementStatus status) {
        return (root, query, cb) -> {
            List<Predicate> predicates = commonPredicates(filter, root, cb);
            if (status != null) {
                predicates.add(cb.equal(root.get("status"), status));
            }
            String currency = normalizeCurrency(filter.currencyCode());
            if (currency != null) {
                predicates.add(cb.equal(root.get("currencyCode"), currency));
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };
    }

    private static Specification<ExchangeTransaction> exchangeSpec(
            AdminTransactionFilter filter, ExchangeTransactionStatus status) {
        return (root, query, cb) -> {
            List<Predicate> predicates = commonPredicates(filter, root, cb);
            if (status != null) {
                predicates.add(cb.equal(root.get("status"), status));
            }
            String currency = normalizeCurrency(filter.currencyCode());
            if (currency != null) {
                Subquery<UUID> sourceWallets = query.subquery(UUID.class);
                Root<Wallet> sw = sourceWallets.from(Wallet.class);
                sourceWallets.select(sw.get("id")).where(cb.equal(sw.get("currencyCode"), currency));
                Subquery<UUID> targetWallets = query.subquery(UUID.class);
                Root<Wallet> tw = targetWallets.from(Wallet.class);
                targetWallets.select(tw.get("id")).where(cb.equal(tw.get("currencyCode"), currency));
                predicates.add(cb.or(
                        root.get("sourceWalletId").in(sourceWallets),
                        root.get("targetWalletId").in(targetWallets)));
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };
    }

    private static <T> List<Predicate> commonPredicates(
            AdminTransactionFilter filter, Root<T> root, CriteriaBuilder cb) {
        List<Predicate> predicates = new ArrayList<>();
        if (filter.userId() != null) {
            predicates.add(cb.equal(root.get("userId"), filter.userId()));
        }
        if (filter.from() != null) {
            predicates.add(cb.greaterThanOrEqualTo(root.<Instant>get("createdAt"), filter.from()));
        }
        if (filter.to() != null) {
            predicates.add(cb.lessThanOrEqualTo(root.<Instant>get("createdAt"), filter.to()));
        }
        return predicates;
    }

    private static String normalizeCurrency(String currencyCode) {
        if (currencyCode == null || currencyCode.isBlank()) {
            return null;
        }
        return currencyCode.trim().toUpperCase(Locale.ROOT);
    }

    /** Which sources participate for a filter, with the status parsed per source enum. */
    private record AdminSources(
            boolean funding,
            boolean withdrawal,
            boolean exchange,
            MoneyMovementStatus movementStatus,
            ExchangeTransactionStatus exchangeStatus) {

        static AdminSources of(AdminTransactionFilter filter) {
            TransactionActivityType type = filter.type();
            boolean hasStatus = filter.status() != null && !filter.status().isBlank();
            MoneyMovementStatus movement = hasStatus ? parseEnum(MoneyMovementStatus.class, filter.status()) : null;
            ExchangeTransactionStatus exchange = hasStatus
                    ? parseEnum(ExchangeTransactionStatus.class, filter.status())
                    : null;
            boolean movementOk = !hasStatus || movement != null;
            boolean exchangeOk = !hasStatus || exchange != null;
            return new AdminSources(
                    (type == null || type == TransactionActivityType.FUNDING) && movementOk,
                    (type == null || type == TransactionActivityType.WITHDRAWAL) && movementOk,
                    (type == null || type == TransactionActivityType.EXCHANGE) && exchangeOk,
                    movement,
                    exchange);
        }

        private static <E extends Enum<E>> E parseEnum(Class<E> type, String raw) {
            try {
                return Enum.valueOf(type, raw.trim().toUpperCase(Locale.ROOT));
            } catch (IllegalArgumentException ex) {
                return null;
            }
        }
    }

    private long countInRange(UUID userId, TransactionActivityType typeFilter, Instant from, Instant to) {
        long total = 0;
        if (typeFilter == null || typeFilter == TransactionActivityType.FUNDING) {
            total += fundingRepository
                    .findByUserIdAndCreatedAtGreaterThanEqualAndCreatedAtLessThanEqual(userId, from, to)
                    .size();
        }
        if (typeFilter == null || typeFilter == TransactionActivityType.WITHDRAWAL) {
            total += withdrawalRepository
                    .findByUserIdAndCreatedAtGreaterThanEqualAndCreatedAtLessThanEqual(userId, from, to)
                    .size();
        }
        if (typeFilter == null || typeFilter == TransactionActivityType.EXCHANGE) {
            total += exchangeRepository
                    .findByUserIdAndCreatedAtGreaterThanEqualAndCreatedAtLessThanEqual(userId, from, to)
                    .size();
        }
        return total;
    }

    private TransactionItemResponse fromFunding(FundingTransaction f) {
        Map<String, UUID> ledger = new LinkedHashMap<>();
        if (f.getLedgerEntryId() != null) {
            ledger.put("credit", f.getLedgerEntryId());
        }
        if (f.getReversalLedgerEntryId() != null) {
            ledger.put("reversal", f.getReversalLedgerEntryId());
        }
        return new TransactionItemResponse(
                TransactionActivityType.FUNDING,
                f.getId(),
                f.getUserId(),
                f.getStatus().name(),
                f.getWalletId(),
                null,
                f.getCurrencyCode(),
                null,
                f.getAmount(),
                null,
                null,
                f.getFailureReason(),
                Map.copyOf(ledger),
                f.getCreatedAt(),
                f.getUpdatedAt());
    }

    private TransactionItemResponse fromWithdrawal(WithdrawalTransaction w) {
        Map<String, UUID> ledger = new LinkedHashMap<>();
        if (w.getHoldLedgerEntryId() != null) {
            ledger.put("hold", w.getHoldLedgerEntryId());
        }
        if (w.getReleaseLedgerEntryId() != null) {
            ledger.put("release", w.getReleaseLedgerEntryId());
        }
        if (w.getDebitLedgerEntryId() != null) {
            ledger.put("debit", w.getDebitLedgerEntryId());
        }
        if (w.getReversalLedgerEntryId() != null) {
            ledger.put("reversal", w.getReversalLedgerEntryId());
        }
        return new TransactionItemResponse(
                TransactionActivityType.WITHDRAWAL,
                w.getId(),
                w.getUserId(),
                w.getStatus().name(),
                w.getWalletId(),
                null,
                w.getCurrencyCode(),
                null,
                w.getAmount(),
                null,
                null,
                w.getFailureReason(),
                Map.copyOf(ledger),
                w.getCreatedAt(),
                w.getUpdatedAt());
    }

    private TransactionItemResponse fromExchange(ExchangeTransaction e) {
        return fromExchange(e, walletId -> walletRepository.findById(walletId)
                .map(Wallet::getCurrencyCode)
                .orElse(null));
    }

    private TransactionItemResponse fromExchange(ExchangeTransaction e, Function<UUID, String> walletCurrency) {
        String sourceCurrency = walletCurrency.apply(e.getSourceWalletId());
        String targetCurrency = walletCurrency.apply(e.getTargetWalletId());
        Map<String, UUID> ledger = new LinkedHashMap<>();
        if (e.getDebitLedgerEntryId() != null) {
            ledger.put("debit", e.getDebitLedgerEntryId());
        }
        if (e.getCreditLedgerEntryId() != null) {
            ledger.put("credit", e.getCreditLedgerEntryId());
        }
        return new TransactionItemResponse(
                TransactionActivityType.EXCHANGE,
                e.getId(),
                e.getUserId(),
                e.getStatus().name(),
                e.getSourceWalletId(),
                e.getTargetWalletId(),
                sourceCurrency,
                targetCurrency,
                e.getSourceAmount(),
                e.getTargetAmount(),
                e.getAppliedRate(),
                e.getFailureReason(),
                Map.copyOf(ledger),
                e.getCreatedAt(),
                e.getUpdatedAt());
    }

    private static List<CurrencyAmountTotal> toTotals(Map<String, CurrencyAccumulator> map) {
        return map.values().stream()
                .sorted(Comparator.comparing(a -> a.currencyCode))
                .map(a -> new CurrencyAmountTotal(a.currencyCode, a.total, a.count))
                .toList();
    }

    private static final class CurrencyAccumulator {
        private final String currencyCode;
        private BigDecimal total = BigDecimal.ZERO;
        private long count;

        private CurrencyAccumulator(String currencyCode) {
            this.currencyCode = Objects.requireNonNull(currencyCode);
        }

        private void add(BigDecimal amount) {
            total = total.add(amount);
            count++;
        }
    }
}
