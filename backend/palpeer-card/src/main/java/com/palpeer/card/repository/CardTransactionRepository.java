package com.palpeer.card.repository;

import com.palpeer.card.domain.CardTransaction;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface CardTransactionRepository extends JpaRepository<CardTransaction, UUID> {

    Page<CardTransaction> findByCardIdAndUserIdOrderByOccurredAtDesc(
            UUID cardId, UUID userId, Pageable pageable);

    Page<CardTransaction> findByCardIdOrderByOccurredAtDesc(UUID cardId, Pageable pageable);

    Optional<CardTransaction> findByCardIdAndProviderTransactionId(UUID cardId, String providerTransactionId);
}
