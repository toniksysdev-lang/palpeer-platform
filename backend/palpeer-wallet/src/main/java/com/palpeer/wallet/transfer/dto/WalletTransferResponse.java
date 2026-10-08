package com.palpeer.wallet.transfer.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record WalletTransferResponse(
        UUID id,
        UUID senderUserId,
        UUID recipientUserId,
        UUID sourceWalletId,
        UUID destinationWalletId,
        String currencyCode,
        BigDecimal amount,
        String note,
        Instant createdAt
) {
}
