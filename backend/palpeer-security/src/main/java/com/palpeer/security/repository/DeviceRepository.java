package com.palpeer.security.repository;

import com.palpeer.security.domain.Device;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface DeviceRepository extends JpaRepository<Device, UUID> {

    List<Device> findByUserId(UUID userId);

    Optional<Device> findByIdAndUserId(UUID id, UUID userId);

    Optional<Device> findByUserIdAndDeviceIdentifier(UUID userId, String deviceIdentifier);

    boolean existsByUserIdAndDeviceIdentifier(UUID userId, String deviceIdentifier);
}
