package com.palpeer.wallet.repository;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.util.List;
import org.springframework.stereotype.Repository;

/**
 * InstantEX (exchange) contribution to pool funds without depending on the exchange module
 * (wallet ← exchange would create a Maven cycle).
 *
 * <p>Source currency amounts are received into the pool; target currency amounts are paid out.
 */
@Repository
public class InstantExPoolContributionRepository {

    @PersistenceContext
    private EntityManager entityManager;

    /** SUCCESS InstantEX source amounts grouped by source wallet currency (pool receives). */
    @SuppressWarnings("unchecked")
    public List<Object[]> sumReceivedByCurrency() {
        return entityManager
                .createNativeQuery(
                        """
                        select upper(w.currency_code), coalesce(sum(et.source_amount), 0)
                        from exchange_transactions et
                        inner join wallets w on w.id = et.source_wallet_id
                        where et.status = 'SUCCESS'
                        group by upper(w.currency_code)
                        """)
                .getResultList();
    }

    /** SUCCESS InstantEX target amounts grouped by target wallet currency (pool pays). */
    @SuppressWarnings("unchecked")
    public List<Object[]> sumPaidByCurrency() {
        return entityManager
                .createNativeQuery(
                        """
                        select upper(w.currency_code), coalesce(sum(et.target_amount), 0)
                        from exchange_transactions et
                        inner join wallets w on w.id = et.target_wallet_id
                        where et.status = 'SUCCESS'
                        group by upper(w.currency_code)
                        """)
                .getResultList();
    }
}
