package com.palpeer.common.settings;

import java.util.Comparator;
import java.util.List;
import java.util.Locale;

/**
 * Best-effort ISO2 from an E.164 phone for registration-corridor countries.
 * Longer dial codes win; {@code +1} prefers CA (same as mobile signup).
 */
public final class PhoneCountryResolver {

    private record Dial(String digits, String iso2) {}

    /** Corridor dial digits (no plus), longest first after sort. */
    private static final List<Dial> CORRIDOR_DIALS = List.of(
            new Dial("234", "NG"),
            new Dial("233", "GH"),
            new Dial("254", "KE"),
            new Dial("44", "GB"),
            new Dial("1", "CA"));

    private PhoneCountryResolver() {}

    /** @return ISO 3166-1 alpha-2, or null when the phone cannot be matched */
    public static String iso2FromE164(String e164) {
        String digits = digitsOnly(e164);
        if (digits.length() < 8) {
            return null;
        }
        return CORRIDOR_DIALS.stream()
                .sorted(Comparator.comparingInt((Dial d) -> d.digits().length()).reversed())
                .filter(d -> digits.startsWith(d.digits()))
                .map(Dial::iso2)
                .findFirst()
                .orElse(null);
    }

    private static String digitsOnly(String raw) {
        if (raw == null || raw.isBlank()) {
            return "";
        }
        StringBuilder sb = new StringBuilder(raw.length());
        for (int i = 0; i < raw.length(); i++) {
            char c = raw.charAt(i);
            if (c >= '0' && c <= '9') {
                sb.append(c);
            }
        }
        return sb.toString();
    }

    /** Normalize to upper-case ISO2 or null. */
    public static String normalizeIso2(String iso2) {
        if (iso2 == null || iso2.isBlank()) {
            return null;
        }
        String code = iso2.trim().toUpperCase(Locale.ROOT);
        return code.length() == 2 ? code : null;
    }
}
