package com.palpeer.promotion.repository;

import com.palpeer.promotion.domain.Promotion;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PromotionRepository extends JpaRepository<Promotion, UUID> {

    Optional<Promotion> findByCodeIgnoreCase(String code);

    List<Promotion> findByActiveTrueOrderByCreatedAtDesc();

    boolean existsByCodeIgnoreCase(String code);
}
