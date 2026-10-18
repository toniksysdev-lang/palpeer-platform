package com.palpeer.wallet.transfer;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface WalletTransferRepository
        extends JpaRepository<WalletTransfer, UUID>, JpaSpecificationExecutor<WalletTransfer> {

    Optional<WalletTransfer> findByIdempotencyKey(String idempotencyKey);

    @Query(
            """
            SELECT t FROM WalletTransfer t
            WHERE t.senderUserId = :userId OR t.recipientUserId = :userId
            ORDER BY t.createdAt DESC
            """)
    List<WalletTransfer> findByPartyUserIdOrderByCreatedAtDesc(
            @Param("userId") UUID userId, Pageable pageable);

    @Query(
            """
            SELECT t FROM WalletTransfer t
            WHERE (t.senderUserId = :userId OR t.recipientUserId = :userId)
              AND t.createdAt >= :from AND t.createdAt <= :to
            ORDER BY t.createdAt DESC
            """)
    List<WalletTransfer> findByPartyUserIdAndCreatedAtGreaterThanEqualAndCreatedAtLessThanEqualOrderByCreatedAtDesc(
            @Param("userId") UUID userId,
            @Param("from") Instant from,
            @Param("to") Instant to,
            Pageable pageable);

    @Query(
            """
            SELECT t FROM WalletTransfer t
            WHERE (t.senderUserId = :userId OR t.recipientUserId = :userId)
              AND t.createdAt >= :from AND t.createdAt <= :to
            """)
    List<WalletTransfer> findByPartyUserIdAndCreatedAtGreaterThanEqualAndCreatedAtLessThanEqual(
            @Param("userId") UUID userId, @Param("from") Instant from, @Param("to") Instant to);

    @Query(
            """
            SELECT t FROM WalletTransfer t
            WHERE t.id = :id AND (t.senderUserId = :userId OR t.recipientUserId = :userId)
            """)
    Optional<WalletTransfer> findByIdAndPartyUserId(@Param("id") UUID id, @Param("userId") UUID userId);
}
