package com.palpeer.user;

import com.palpeer.common.exception.BusinessException;
import java.util.Locale;
import java.util.regex.Pattern;
import org.springframework.http.HttpStatus;

/** Shared username normalize / validate rules for registration and Google signup. */
public final class UsernameRules {

    public static final int MIN_LENGTH = 3;
    public static final int MAX_LENGTH = 32;
    private static final Pattern PATTERN = Pattern.compile("^[a-z0-9_]{" + MIN_LENGTH + "," + MAX_LENGTH + "}$");

    private UsernameRules() {}

    /** Lowercase, trim; strips invalid characters when {@code lenient} (email-derived handles). */
    public static String normalize(String raw, boolean lenient) {
        if (raw == null) {
            return "";
        }
        String value = raw.trim().toLowerCase(Locale.ROOT);
        if (lenient) {
            value = value.replaceAll("[^a-z0-9_]", "");
        }
        if (value.length() > MAX_LENGTH) {
            value = value.substring(0, MAX_LENGTH);
        }
        return value;
    }

    public static String requireValid(String raw) {
        String value = normalize(raw, false);
        if (!PATTERN.matcher(value).matches()) {
            throw new BusinessException(
                    "INVALID_USERNAME",
                    "Username must be " + MIN_LENGTH + "–" + MAX_LENGTH
                            + " characters: lowercase letters, numbers, and underscores only",
                    HttpStatus.BAD_REQUEST);
        }
        return value;
    }

    /** Best-effort handle from an email address (may be empty). */
    public static String fromEmail(String email) {
        if (email == null || !email.contains("@")) {
            return "";
        }
        return normalize(email.substring(0, email.indexOf('@')), true);
    }
}
