package com.palpeer.card.repository;

import com.palpeer.card.domain.Card;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

@Repository
public interface CardRepository extends JpaRepository<Card, UUID>, JpaSpecificationExecutor<Card> {

    List<Card> findByUserIdOrderByCreatedAtDesc(UUID userId);

    Optional<Card> findByIdAndUserId(UUID id, UUID userId);
}
