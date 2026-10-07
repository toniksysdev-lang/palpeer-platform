package com.palpeer.currency.web.dto;

import java.util.UUID;

public record CurrencyResponse(
        UUID id,
        String code,
        String symbol,
        int precision
) {
}
