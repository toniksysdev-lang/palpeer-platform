package com.palpeer.wallet.repository;

import com.palpeer.wallet.domain.PaymentVirtualAccount;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PaymentVirtualAccountRepository extends JpaRepository<PaymentVirtualAccount, UUID> {

    Optional<PaymentVirtualAccount> findByWalletIdAndProviderName(UUID walletId, String providerName);

    Optional<PaymentVirtualAccount> findByProviderNameAndTrackingReference(String providerName, String trackingReference);
}
