package com.palpeer.wallet.repository;

import com.palpeer.wallet.domain.Wallet;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface WalletRepository extends JpaRepository<Wallet, UUID>, JpaSpecificationExecutor<Wallet> {

    List<Wallet> findByUserIdOrderByCurrencyCodeAsc(UUID userId);

    Optional<Wallet> findByIdAndUserId(UUID id, UUID userId);

    boolean existsByUserIdAndCurrencyCodeIgnoreCase(UUID userId, String currencyCode);

    Optional<Wallet> findByUserIdAndCurrencyCodeIgnoreCase(UUID userId, String currencyCode);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select w from Wallet w where w.id = :id")
    Optional<Wallet> findByIdForUpdate(@Param("id") UUID id);
}
