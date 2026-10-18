package com.palpeer.auth.repository;

import com.palpeer.auth.domain.AccountSuspendToken;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface AccountSuspendTokenRepository extends JpaRepository<AccountSuspendToken, UUID> {

    Optional<AccountSuspendToken> findByTokenHashAndConsumedFalse(String tokenHash);
}
