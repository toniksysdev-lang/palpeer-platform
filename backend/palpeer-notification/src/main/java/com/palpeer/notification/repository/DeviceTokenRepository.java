package com.palpeer.notification.repository;

import com.palpeer.notification.domain.DeviceToken;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface DeviceTokenRepository extends JpaRepository<DeviceToken, UUID> {

    Optional<DeviceToken> findByToken(String token);

    Optional<DeviceToken> findByIdAndUserId(UUID id, UUID userId);

    List<DeviceToken> findByUserIdOrderByUpdatedAtDesc(UUID userId);

    List<DeviceToken> findByUserIdAndEnabledTrue(UUID userId);
}
