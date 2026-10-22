package com.palpeer.wallet.web.dto;

import java.util.List;

/** Totals for the Platform fees / revenue dashboard cards. */
public record PlatformFeeSummaryResponse(
        List<PlatformFeeCurrencyTotal> grandTotal,
        List<PlatformFeeCurrencyTotal> p2pTotal,
        List<PlatformFeeCurrencyTotal> instantExTotal) {}
