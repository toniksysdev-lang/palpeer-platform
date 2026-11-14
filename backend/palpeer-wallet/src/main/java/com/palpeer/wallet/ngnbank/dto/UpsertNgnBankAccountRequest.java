package com.palpeer.wallet.ngnbank.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record UpsertNgnBankAccountRequest(
        @NotBlank @Size(max = 20) String bankCode,
        @NotBlank @Size(max = 120) String bankName,
        @NotBlank @Pattern(regexp = "\\d{10}") String accountNumber,
        @NotBlank @Size(max = 160) String accountName) {}
