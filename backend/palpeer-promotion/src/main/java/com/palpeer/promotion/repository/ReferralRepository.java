package com.palpeer.promotion.repository;

import com.palpeer.promotion.domain.Referral;
import com.palpeer.promotion.domain.ReferralStatus;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

@Repository
public interface ReferralRepository extends JpaRepository<Referral, UUID>, JpaSpecificationExecutor<Referral> {

    Optional<Referral> findByReferralCodeIgnoreCase(String referralCode);

    Optional<Referral> findByReferrerUserIdAndRefereeUserIdIsNull(UUID referrerUserId);

    List<Referral> findByReferrerUserIdOrderByCreatedAtDesc(UUID referrerUserId);

    boolean existsByRefereeUserId(UUID refereeUserId);

    Optional<Referral> findByRefereeUserId(UUID refereeUserId);
}
