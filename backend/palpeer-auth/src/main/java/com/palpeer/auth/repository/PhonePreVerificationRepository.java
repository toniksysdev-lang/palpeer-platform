package com.palpeer.auth.repository;

import com.palpeer.auth.domain.PhonePreVerification;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PhonePreVerificationRepository extends JpaRepository<PhonePreVerification, UUID> {

    Optional<PhonePreVerification> findByPhone(String phone);
}
