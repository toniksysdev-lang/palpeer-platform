package com.palpeer.admin.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.palpeer.admin.domain.AdminUser;
import com.palpeer.admin.domain.Permission;
import com.palpeer.admin.domain.Role;
import com.palpeer.admin.repository.AdminUserRepository;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.GrantedAuthority;

@ExtendWith(MockitoExtension.class)
class AdminAuthorityEnricherTest {

    @Mock private AdminUserRepository adminUserRepository;
    @InjectMocks private AdminAuthorityEnricher enricher;

    @Test
    void authoritiesFor_enabledAdminIncludesRoleAndPermissions() {
        UUID userId = UUID.randomUUID();
        Permission perm = new Permission();
        perm.setCode("users:read");
        Role role = new Role();
        role.setCode("SUPER_ADMIN");
        role.setPermissions(Set.of(perm));
        AdminUser admin = new AdminUser();
        admin.setUserId(userId);
        admin.setEnabled(true);
        admin.setRoles(Set.of(role));

        when(adminUserRepository.findByUserIdAndEnabledTrue(userId)).thenReturn(Optional.of(admin));

        Set<String> codes = enricher.authoritiesFor(userId).stream()
                .map(GrantedAuthority::getAuthority)
                .collect(Collectors.toSet());

        assertThat(codes).contains("ROLE_ADMIN", "ROLE_SUPER_ADMIN", "users:read");
    }

    @Test
    void authoritiesFor_nonAdminReturnsEmpty() {
        UUID userId = UUID.randomUUID();
        when(adminUserRepository.findByUserIdAndEnabledTrue(userId)).thenReturn(Optional.empty());

        assertThat(enricher.authoritiesFor(userId)).isEmpty();
    }
}
