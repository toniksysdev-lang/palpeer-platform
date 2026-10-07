package com.palpeer.security.repository;

import com.palpeer.security.domain.PinCredential;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface PinCredentialRepository extends JpaRepository<PinCredential, UUID> {

    Optional<PinCredential> findByUserId(UUID userId);

    boolean existsByUserId(UUID userId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from PinCredential p where p.userId = :userId")
    Optional<PinCredential> findByUserIdForUpdate(@Param("userId") UUID userId);
}
