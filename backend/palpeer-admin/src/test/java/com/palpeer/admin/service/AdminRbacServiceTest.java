package com.palpeer.admin.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.palpeer.admin.domain.AdminUser;
import com.palpeer.admin.domain.Permission;
import com.palpeer.admin.domain.Role;
import com.palpeer.admin.repository.AdminUserRepository;
import com.palpeer.admin.repository.PermissionRepository;
import com.palpeer.admin.repository.RoleRepository;
import com.palpeer.admin.web.dto.AssignAdminRequest;
import com.palpeer.admin.web.dto.CreatePermissionRequest;
import com.palpeer.admin.web.dto.CreateRoleRequest;
import com.palpeer.admin.web.dto.UpdateRoleRequest;
import com.palpeer.common.exception.BusinessException;
import com.palpeer.common.exception.ResourceNotFoundException;
import com.palpeer.user.domain.User;
import com.palpeer.user.repository.UserRepository;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class AdminRbacServiceTest {

    @Mock private AdminUserRepository adminUserRepository;
    @Mock private RoleRepository roleRepository;
    @Mock private PermissionRepository permissionRepository;
    @Mock private UserRepository userRepository;
    @Mock private com.palpeer.common.audit.AuditRecorder auditRecorder;
    @InjectMocks private AdminRbacService adminRbacService;

    @Test
    void assign_grantsRolesToExistingUser() {
        UUID userId = UUID.randomUUID();
        User user = new User();
        user.setId(userId);
        Role role = new Role();
        role.setCode("SUPER_ADMIN");
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(roleRepository.findByCode("SUPER_ADMIN")).thenReturn(Optional.of(role));
        when(adminUserRepository.findByUserId(userId)).thenReturn(Optional.empty());
        when(adminUserRepository.save(any(AdminUser.class))).thenAnswer(inv -> {
            AdminUser saved = inv.getArgument(0);
            saved.setId(UUID.randomUUID());
            return saved;
        });

        var response = adminRbacService.assign(new AssignAdminRequest(userId, List.of("SUPER_ADMIN")));

        assertThat(response.userId()).isEqualTo(userId);
        assertThat(response.enabled()).isTrue();
        assertThat(response.roleCodes()).containsExactly("SUPER_ADMIN");
        verify(adminUserRepository).save(any(AdminUser.class));
    }

    @Test
    void assign_rejectsEmptyRoles() {
        UUID userId = UUID.randomUUID();
        when(userRepository.findById(userId)).thenReturn(Optional.of(new User()));

        assertThatThrownBy(() -> adminRbacService.assign(new AssignAdminRequest(userId, List.of())))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("roleCode");
    }

    @Test
    void disable_requiresAdminRow() {
        UUID userId = UUID.randomUUID();
        when(adminUserRepository.findByUserId(userId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> adminRbacService.disable(userId))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void disable_setsEnabledFalse() {
        UUID userId = UUID.randomUUID();
        AdminUser admin = new AdminUser();
        admin.setId(UUID.randomUUID());
        admin.setUserId(userId);
        admin.setEnabled(true);
        admin.setRoles(Set.of());
        when(adminUserRepository.findByUserId(userId)).thenReturn(Optional.of(admin));
        when(adminUserRepository.save(any(AdminUser.class))).thenAnswer(inv -> inv.getArgument(0));

        var response = adminRbacService.disable(userId);

        assertThat(response.enabled()).isFalse();
    }

    @Test
    void createRole_attachesPermissions() {
        Permission permission = new Permission();
        permission.setCode("users:read");
        when(roleRepository.findByCode("OPS_ADMIN")).thenReturn(Optional.empty());
        when(permissionRepository.findByCode("users:read")).thenReturn(Optional.of(permission));
        when(roleRepository.save(any(Role.class))).thenAnswer(inv -> {
            Role saved = inv.getArgument(0);
            saved.setId(UUID.randomUUID());
            return saved;
        });

        var response = adminRbacService.createRole(
                new CreateRoleRequest("OPS_ADMIN", "Ops Admin", "Operations", List.of("users:read")));

        assertThat(response.code()).isEqualTo("OPS_ADMIN");
        assertThat(response.permissionCodes()).containsExactly("users:read");
    }

    @Test
    void createPermission_rejectsDuplicate() {
        when(permissionRepository.findByCode("users:read")).thenReturn(Optional.of(new Permission()));

        assertThatThrownBy(() ->
                        adminRbacService.createPermission(new CreatePermissionRequest("users:read", "dup")))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("already exists");
    }

    @Test
    void updateRole_rejectsStrippingAdminManageFromSuperAdmin() {
        Permission usersRead = new Permission();
        usersRead.setCode("users:read");
        Role role = new Role();
        role.setId(UUID.randomUUID());
        role.setCode("SUPER_ADMIN");
        role.setName("Super Admin");
        role.setPermissions(Set.of(usersRead));
        when(roleRepository.findByCode("SUPER_ADMIN")).thenReturn(Optional.of(role));
        when(permissionRepository.findByCode("users:read")).thenReturn(Optional.of(usersRead));

        assertThatThrownBy(() ->
                        adminRbacService.updateRole(
                                "SUPER_ADMIN", new UpdateRoleRequest(null, null, List.of("users:read"))))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("admin:manage");
    }
}
