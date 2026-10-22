package com.palpeer.common.settings;

import java.util.Locale;
import java.util.Map;

/**
 * Primary wallet currency for each registration-corridor country (ISO 3166-1 alpha-2 → ISO 4217).
 * Mirrors the mobile {@code REGISTRATION_COUNTRY_CURRENCY} map used for New wallet / signup.
 */
public final class RegistrationCorridorCurrencies {

    public static final Map<String, String> ISO2_TO_CURRENCY = Map.ofEntries(
            Map.entry("CA", "CAD"),
            Map.entry("US", "USD"),
            Map.entry("GB", "GBP"),
            Map.entry("NG", "NGN"),
            Map.entry("GH", "GHS"),
            Map.entry("KE", "KES"),
            Map.entry("IE", "EUR"),
            Map.entry("DE", "EUR"),
            Map.entry("FR", "EUR"),
            Map.entry("NL", "EUR"),
            Map.entry("ES", "EUR"),
            Map.entry("IT", "EUR"),
            Map.entry("PT", "EUR"),
            Map.entry("BE", "EUR"),
            Map.entry("AT", "EUR"),
            Map.entry("FI", "EUR"),
            Map.entry("AU", "AUD"),
            Map.entry("NZ", "NZD"),
            Map.entry("ZA", "ZAR"),
            Map.entry("IN", "INR"));

    private RegistrationCorridorCurrencies() {}

    /** @return ISO 4217 code, or null when the country is not mapped */
    public static String currencyForIso2(String iso2) {
        if (iso2 == null || iso2.isBlank()) {
            return null;
        }
        return ISO2_TO_CURRENCY.get(iso2.trim().toUpperCase(Locale.ROOT));
    }
}
