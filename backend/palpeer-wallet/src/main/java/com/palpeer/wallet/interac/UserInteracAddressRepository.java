package com.palpeer.wallet.interac;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface UserInteracAddressRepository extends JpaRepository<UserInteracAddress, UUID> {

    List<UserInteracAddress> findByUserIdOrderByCreatedAtDesc(UUID userId);

    Optional<UserInteracAddress> findByIdAndUserId(UUID id, UUID userId);

    Optional<UserInteracAddress> findByUserIdAndEmailIgnoreCase(UUID userId, String email);
}
