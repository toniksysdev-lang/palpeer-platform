package com.palpeer.wallet.web.dto;

import java.math.BigDecimal;

/** Aggregated platform fee amount for one currency. */
public record PlatformFeeCurrencyTotal(String currencyCode, BigDecimal amount, long count) {}
