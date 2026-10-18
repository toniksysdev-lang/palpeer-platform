package com.palpeer.auth.repository;

import com.palpeer.auth.domain.RefreshToken;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface RefreshTokenRepository extends JpaRepository<RefreshToken, UUID> {

    Optional<RefreshToken> findByTokenHashAndRevokedFalse(String tokenHash);

    List<RefreshToken> findByUserIdAndRevokedFalse(UUID userId);

    List<RefreshToken> findByUserIdAndRevokedFalseAndExpiresAtAfterOrderByCreatedAtDesc(UUID userId, Instant now);

    Optional<RefreshToken> findByIdAndUserId(UUID id, UUID userId);

    void deleteByUserId(UUID userId);

    /** Any historical session on this install (revoked or active) — used for "new device" detection. */
    boolean existsByUserIdAndDeviceIdentifier(UUID userId, String deviceIdentifier);
}
