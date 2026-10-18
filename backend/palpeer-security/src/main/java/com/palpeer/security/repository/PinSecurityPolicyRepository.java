package com.palpeer.security.repository;

import com.palpeer.security.domain.PinSecurityPolicy;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PinSecurityPolicyRepository extends JpaRepository<PinSecurityPolicy, Short> {}
