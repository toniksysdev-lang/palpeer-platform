package com.palpeer.auth.security;

import com.palpeer.user.domain.User;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import lombok.Getter;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

@Getter
public class UserPrincipal implements UserDetails {

    private final UUID id;
    private final String email;
    private final String passwordHash;
    private final boolean enabled;
    private final Collection<? extends GrantedAuthority> authorities;

    public UserPrincipal(User user) {
        this(user, List.of(new SimpleGrantedAuthority("ROLE_USER")));
    }

    public UserPrincipal(User user, Collection<? extends GrantedAuthority> authorities) {
        this.id = user.getId();
        this.email = user.getEmail();
        this.passwordHash = user.getPasswordHash();
        this.enabled = user.isEnabled();
        this.authorities = List.copyOf(authorities);
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return authorities;
    }

    @Override
    public String getPassword() {
        return passwordHash;
    }

    @Override
    public String getUsername() {
        return email;
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return true;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return enabled;
    }

    public static Collection<GrantedAuthority> mergeBaseAndEnrichers(
            User user, List<AuthorityEnricher> enrichers) {
        List<GrantedAuthority> authorities = new ArrayList<>();
        authorities.add(new SimpleGrantedAuthority("ROLE_USER"));
        if (enrichers != null) {
            for (AuthorityEnricher enricher : enrichers) {
                Collection<? extends GrantedAuthority> extra = enricher.authoritiesFor(user.getId());
                if (extra != null) {
                    authorities.addAll(extra);
                }
            }
        }
        return authorities;
    }
}
