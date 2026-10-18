package com.palpeer.promotion.repository;

import com.palpeer.promotion.domain.MarketingAdvert;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface MarketingAdvertRepository extends JpaRepository<MarketingAdvert, UUID> {

    List<MarketingAdvert> findByActiveTrueOrderBySortOrderAscCreatedAtDesc();

    List<MarketingAdvert> findAllByOrderBySortOrderAscCreatedAtDesc();
}
