package com.palpeer.ledger.repository;

import com.palpeer.ledger.domain.LedgerEntry;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface LedgerEntryRepository extends JpaRepository<LedgerEntry, UUID> {

    Optional<LedgerEntry> findByIdempotencyKey(String idempotencyKey);

    Page<LedgerEntry> findByWalletIdOrderByCreatedAtDesc(UUID walletId, Pageable pageable);

    boolean existsByIdempotencyKey(String idempotencyKey);
}
