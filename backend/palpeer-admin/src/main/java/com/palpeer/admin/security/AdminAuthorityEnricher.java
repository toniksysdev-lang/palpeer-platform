package com.palpeer.admin.security;

import com.palpeer.admin.domain.AdminUser;
import com.palpeer.admin.domain.Permission;
import com.palpeer.admin.domain.Role;
import com.palpeer.admin.repository.AdminUserRepository;
import com.palpeer.auth.security.AuthorityEnricher;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class AdminAuthorityEnricher implements AuthorityEnricher {

    private final AdminUserRepository adminUserRepository;

    @Override
    public Collection<? extends GrantedAuthority> authoritiesFor(UUID userId) {
        return adminUserRepository.findByUserIdAndEnabledTrue(userId)
                .map(this::toAuthorities)
                .orElseGet(List::of);
    }

    private Collection<? extends GrantedAuthority> toAuthorities(AdminUser adminUser) {
        List<GrantedAuthority> authorities = new ArrayList<>();
        authorities.add(new SimpleGrantedAuthority("ROLE_ADMIN"));
        for (Role role : adminUser.getRoles()) {
            authorities.add(new SimpleGrantedAuthority("ROLE_" + role.getCode()));
            for (Permission permission : role.getPermissions()) {
                authorities.add(new SimpleGrantedAuthority(permission.getCode()));
            }
        }
        return authorities;
    }
}
