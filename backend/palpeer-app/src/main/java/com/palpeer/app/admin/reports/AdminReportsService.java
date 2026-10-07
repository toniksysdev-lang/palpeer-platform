package com.palpeer.app.admin.reports;

import com.palpeer.app.admin.reports.AdminReportSummaryResponse.Bonuses;
import com.palpeer.app.admin.reports.AdminReportSummaryResponse.ByStatus;
import com.palpeer.app.admin.reports.AdminReportSummaryResponse.CurrencyBalance;
import com.palpeer.app.admin.reports.AdminReportSummaryResponse.P2P;
import com.palpeer.app.admin.reports.AdminReportSummaryResponse.StatusCounts;
import com.palpeer.app.admin.reports.AdminReportSummaryResponse.StatusCurrencyAmount;
import com.palpeer.app.admin.reports.AdminReportSummaryResponse.SuccessVolume;
import com.palpeer.app.admin.reports.AdminReportSummaryResponse.Transactions;
import com.palpeer.app.admin.reports.AdminReportSummaryResponse.Wallets;
import com.palpeer.card.domain.CardStatus;
import com.palpeer.exchange.domain.ExchangeTransactionStatus;
import com.palpeer.kyc.domain.KycStatus;
import com.palpeer.p2p.domain.P2PStatus;
import com.palpeer.promotion.domain.BonusStatus;
import com.palpeer.promotion.domain.ReferralStatus;
import com.palpeer.transaction.domain.TransactionActivityType;
import com.palpeer.user.domain.UserStatus;
import com.palpeer.wallet.funding.MoneyMovementStatus;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Aggregate counts/sums over existing tables. Pure projection: no fees, eligibility, or settlement.
 * successVolume follows the P11-04 customer summary definition (SUCCESS rows; exchange uses source amount
 * grouped by source wallet currency).
 */
@Service
public class AdminReportsService {

    public static final int DEFAULT_WINDOW_DAYS = 30;

    @PersistenceContext
    private EntityManager em;

    @Transactional(readOnly = true)
    public AdminReportSummaryResponse summary(Instant from, Instant to) {
        Instant rangeTo = to != null ? to : Instant.now();
        Instant rangeFrom = from != null ? from : rangeTo.minus(DEFAULT_WINDOW_DAYS, ChronoUnit.DAYS);

        Map<String, Long> usersByStatus = appUsersByStatus();
        Map<String, Long> kycByStatus = countByStatus("KycCase", KycStatus.class);

        return new AdminReportSummaryResponse(
                Instant.now(),
                rangeFrom,
                rangeTo,
                new StatusCounts(sum(usersByStatus), usersByStatus),
                new StatusCounts(sum(kycByStatus), kycByStatus),
                wallets(),
                transactions(rangeFrom, rangeTo),
                new P2P(countByStatus("P2PRequest", P2PStatus.class), countByStatus("P2POrder", P2PStatus.class)),
                new ByStatus(countByStatus("Card", CardStatus.class)),
                new ByStatus(countByStatus("Referral", ReferralStatus.class)),
                bonuses());
    }

    private Wallets wallets() {
        List<Object[]> rows = em.createQuery("""
                        select w.currencyCode, count(w), sum(w.availableBalance), sum(w.pendingBalance)
                        from Wallet w
                        group by w.currencyCode
                        order by w.currencyCode
                        """, Object[].class)
                .getResultList();
        List<CurrencyBalance> balances = new ArrayList<>();
        long total = 0;
        for (Object[] row : rows) {
            long count = ((Number) row[1]).longValue();
            total += count;
            balances.add(new CurrencyBalance((String) row[0], count, decimal(row[2]), decimal(row[3])));
        }
        return new Wallets(total, balances);
    }

    private Transactions transactions(Instant from, Instant to) {
        Map<String, Long> countsByType = new LinkedHashMap<>();
        for (TransactionActivityType type : TransactionActivityType.values()) {
            countsByType.put(type.name(), 0L);
        }
        Map<String, Long> countsByTypeAndStatus = new LinkedHashMap<>();
        List<SuccessVolume> successVolume = new ArrayList<>();

        accumulate(TransactionActivityType.FUNDING, MoneyMovementStatus.SUCCESS.name(), em.createQuery("""
                        select f.status, f.currencyCode, count(f), sum(f.amount)
                        from FundingTransaction f
                        where f.createdAt >= :from and f.createdAt <= :to
                        group by f.status, f.currencyCode
                        """, Object[].class)
                .setParameter("from", from)
                .setParameter("to", to)
                .getResultList(), countsByType, countsByTypeAndStatus, successVolume);

        accumulate(TransactionActivityType.WITHDRAWAL, MoneyMovementStatus.SUCCESS.name(), em.createQuery("""
                        select w.status, w.currencyCode, count(w), sum(w.amount)
                        from WithdrawalTransaction w
                        where w.createdAt >= :from and w.createdAt <= :to
                        group by w.status, w.currencyCode
                        """, Object[].class)
                .setParameter("from", from)
                .setParameter("to", to)
                .getResultList(), countsByType, countsByTypeAndStatus, successVolume);

        accumulate(TransactionActivityType.EXCHANGE, ExchangeTransactionStatus.SUCCESS.name(), em.createQuery("""
                        select e.status, sw.currencyCode, count(e), sum(e.sourceAmount)
                        from ExchangeTransaction e
                        left join Wallet sw on sw.id = e.sourceWalletId
                        where e.createdAt >= :from and e.createdAt <= :to
                        group by e.status, sw.currencyCode
                        """, Object[].class)
                .setParameter("from", from)
                .setParameter("to", to)
                .getResultList(), countsByType, countsByTypeAndStatus, successVolume);

        successVolume.sort(Comparator.comparing(SuccessVolume::type)
                .thenComparing(SuccessVolume::currencyCode, Comparator.nullsLast(Comparator.naturalOrder())));
        return new Transactions(countsByType, countsByTypeAndStatus, successVolume);
    }

    private static void accumulate(
            TransactionActivityType type,
            String successStatus,
            List<Object[]> rows,
            Map<String, Long> countsByType,
            Map<String, Long> countsByTypeAndStatus,
            List<SuccessVolume> successVolume) {
        for (Object[] row : rows) {
            String status = ((Enum<?>) row[0]).name();
            String currency = (String) row[1];
            long count = ((Number) row[2]).longValue();
            countsByType.merge(type.name(), count, Long::sum);
            countsByTypeAndStatus.merge(type.name() + ":" + status, count, Long::sum);
            if (successStatus.equals(status)) {
                successVolume.add(new SuccessVolume(type.name(), currency, count, decimal(row[3])));
            }
        }
    }

    private Bonuses bonuses() {
        List<Object[]> rows = em.createQuery("""
                        select b.status, b.currencyCode, sum(b.amount)
                        from Bonus b
                        group by b.status, b.currencyCode
                        order by b.status, b.currencyCode
                        """, Object[].class)
                .getResultList();
        List<StatusCurrencyAmount> amounts = new ArrayList<>();
        for (Object[] row : rows) {
            amounts.add(new StatusCurrencyAmount(((Enum<?>) row[0]).name(), (String) row[1], decimal(row[2])));
        }
        return new Bonuses(countByStatus("Bonus", BonusStatus.class), amounts);
    }

    /** Status to count for every enum constant (zero when absent). */
    private <E extends Enum<E>> Map<String, Long> countByStatus(String entityName, Class<E> statusType) {
        Map<String, Long> counts = new LinkedHashMap<>();
        for (E value : statusType.getEnumConstants()) {
            counts.put(value.name(), 0L);
        }
        List<Object[]> rows = em.createQuery(
                        "select e.status, count(e) from " + entityName + " e group by e.status", Object[].class)
                .getResultList();
        for (Object[] row : rows) {
            counts.put(((Enum<?>) row[0]).name(), ((Number) row[1]).longValue());
        }
        return counts;
    }

    private Map<String, Long> appUsersByStatus() {
        Map<String, Long> counts = new LinkedHashMap<>();
        for (UserStatus value : UserStatus.values()) {
            counts.put(value.name(), 0L);
        }
        List<Object[]> rows = em.createQuery("""
                        select u.status, count(u) from User u
                        where not exists (select 1 from AdminUser a where a.userId = u.id)
                        group by u.status
                        """, Object[].class)
                .getResultList();
        for (Object[] row : rows) {
            counts.put(((Enum<?>) row[0]).name(), ((Number) row[1]).longValue());
        }
        return counts;
    }

    private static long sum(Map<String, Long> counts) {
        return counts.values().stream().mapToLong(Long::longValue).sum();
    }

    private static BigDecimal decimal(Object value) {
        if (value == null) {
            return BigDecimal.ZERO;
        }
        return value instanceof BigDecimal bd ? bd : new BigDecimal(value.toString());
    }
}
