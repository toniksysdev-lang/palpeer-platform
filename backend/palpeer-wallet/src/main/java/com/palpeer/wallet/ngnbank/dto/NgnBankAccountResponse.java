package com.palpeer.wallet.ngnbank.dto;

import java.time.Instant;
import java.util.UUID;

public record NgnBankAccountResponse(
        UUID id,
        String bankCode,
        String bankName,
        String accountNumber,
        String accountName,
        Instant createdAt) {}
