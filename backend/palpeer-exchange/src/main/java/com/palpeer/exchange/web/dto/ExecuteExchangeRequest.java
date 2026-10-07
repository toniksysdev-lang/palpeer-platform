package com.palpeer.exchange.web.dto;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record ExecuteExchangeRequest(
        @NotNull UUID quoteId
) {
}
