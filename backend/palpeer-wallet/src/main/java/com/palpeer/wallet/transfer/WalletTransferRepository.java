package com.palpeer.wallet.transfer;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WalletTransferRepository extends JpaRepository<WalletTransfer, UUID> {

    Optional<WalletTransfer> findByIdempotencyKey(String idempotencyKey);
}
