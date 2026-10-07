package com.palpeer.app.admin;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

/**
 * Programmatic permission checks for endpoints whose output depends on caller permissions.
 */
public final class AdminAuthorities {

    private AdminAuthorities() {
    }

    public static boolean has(String authority) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null && auth.getAuthorities().stream()
                .anyMatch(granted -> authority.equals(granted.getAuthority()));
    }
}
