package com.palpeer.wallet.withdrawal.dto;

public record BankOptionResponse(
        String code,
        String name,
        String slug
) {
}
