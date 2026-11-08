package com.palpeer.promotion.repository;

import com.palpeer.promotion.domain.BusinessAccountInterest;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface BusinessAccountInterestRepository extends JpaRepository<BusinessAccountInterest, UUID> {

    Optional<BusinessAccountInterest> findByEmailNormalized(String emailNormalized);

    List<BusinessAccountInterest> findAllByOrderByCreatedAtDesc();

    List<BusinessAccountInterest> findByIdIn(Collection<UUID> ids);
}
