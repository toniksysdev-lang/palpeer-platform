package com.palpeer.wallet.ngnbank;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface UserNgnBankAccountRepository extends JpaRepository<UserNgnBankAccount, UUID> {

    List<UserNgnBankAccount> findByUserIdOrderByCreatedAtDesc(UUID userId);

    Optional<UserNgnBankAccount> findByIdAndUserId(UUID id, UUID userId);

    Optional<UserNgnBankAccount> findByUserIdAndBankCodeAndAccountNumber(
            UUID userId, String bankCode, String accountNumber);
}
