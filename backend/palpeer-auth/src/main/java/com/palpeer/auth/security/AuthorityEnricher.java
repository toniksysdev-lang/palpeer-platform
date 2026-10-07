package com.palpeer.auth.security;

import java.util.Collection;
import java.util.UUID;
import org.springframework.security.core.GrantedAuthority;

/**
 * Optional enricher for extra authorities (e.g. admin RBAC).
 * Implemented by other modules; auth stays free of domain coupling.
 */
public interface AuthorityEnricher {

    Collection<? extends GrantedAuthority> authoritiesFor(UUID userId);
}
