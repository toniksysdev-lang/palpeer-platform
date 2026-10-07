package com.palpeer.admin.service;

import com.palpeer.admin.domain.AdminUser;
import com.palpeer.admin.domain.Permission;
import com.palpeer.admin.domain.Role;
import com.palpeer.admin.repository.AdminUserRepository;
import com.palpeer.admin.repository.PermissionRepository;
import com.palpeer.admin.repository.RoleRepository;
import com.palpeer.admin.web.dto.AdminMeResponse;
import com.palpeer.admin.web.dto.AdminUserResponse;
import com.palpeer.admin.web.dto.AssignAdminRequest;
import com.palpeer.admin.web.dto.CreatePermissionRequest;
import com.palpeer.admin.web.dto.CreateRoleRequest;
import com.palpeer.admin.web.dto.PermissionResponse;
import com.palpeer.admin.web.dto.RoleResponse;
import com.palpeer.admin.web.dto.UpdateRoleRequest;
import com.palpeer.auth.security.UserPrincipal;
import com.palpeer.common.audit.AuditRecord;
import com.palpeer.common.audit.AuditRecorder;
import com.palpeer.common.exception.BusinessException;
import com.palpeer.common.exception.ResourceNotFoundException;
import com.palpeer.user.repository.UserRepository;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AdminRbacService {

    public static final String SUPER_ADMIN_CODE = "SUPER_ADMIN";
    public static final String ADMIN_MANAGE_PERMISSION = "admin:manage";

    private final AdminUserRepository adminUserRepository;
    private final RoleRepository roleRepository;
    private final PermissionRepository permissionRepository;
    private final UserRepository userRepository;
    private final AuditRecorder auditRecorder;

    @Transactional
    public AdminUserResponse assign(AssignAdminRequest request) {
        UUID userId = request.userId();
        userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        Set<Role> roles = resolveRoles(request.roleCodes());
        AdminUser adminUser = adminUserRepository.findByUserId(userId).orElseGet(AdminUser::new);
        String oldValue = adminUser.getId() == null
                ? null
                : "enabled=" + adminUser.isEnabled() + ";roles=" + roleCodesOf(adminUser);
        adminUser.setUserId(userId);
        adminUser.setEnabled(true);
        adminUser.setRoles(roles);
        adminUserRepository.save(adminUser);
        auditRecorder.record(AuditRecord.builder("ADMIN_ASSIGN")
                .entity("AdminUser:" + adminUser.getId())
                .userRef(userId)
                .oldValue(oldValue)
                .newValue("enabled=true;roles=" + roleCodesOf(adminUser))
                .build());
        return toAdminResponse(adminUser);
    }

    @Transactional
    public AdminUserResponse disable(UUID userId) {
        AdminUser adminUser = adminUserRepository.findByUserId(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Admin user not found"));
        String oldValue = "enabled=" + adminUser.isEnabled();
        adminUser.setEnabled(false);
        adminUserRepository.save(adminUser);
        auditRecorder.record(AuditRecord.builder("ADMIN_DISABLE")
                .entity("AdminUser:" + adminUser.getId())
                .userRef(userId)
                .oldValue(oldValue)
                .newValue("enabled=false")
                .build());
        return toAdminResponse(adminUser);
    }

    @Transactional(readOnly = true)
    public List<AdminUserResponse> listAdmins() {
        return adminUserRepository.findAll().stream().map(this::toAdminResponse).toList();
    }

    @Transactional(readOnly = true)
    public AdminMeResponse me() {
        UserPrincipal principal = currentPrincipal();
        AdminUser adminUser = adminUserRepository.findByUserId(principal.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Admin user not found"));
        Set<String> permissionCodes = adminUser.getRoles().stream()
                .flatMap(role -> role.getPermissions().stream())
                .map(Permission::getCode)
                .collect(Collectors.toCollection(java.util.TreeSet::new));
        return new AdminMeResponse(
                adminUser.getUserId(),
                principal.getEmail(),
                adminUser.isEnabled(),
                roleCodesOf(adminUser),
                permissionCodes);
    }

    @Transactional(readOnly = true)
    public List<PermissionResponse> listPermissions() {
        return permissionRepository.findAll().stream()
                .sorted(Comparator.comparing(Permission::getCode))
                .map(this::toPermissionResponse)
                .toList();
    }

    @Transactional
    public PermissionResponse createPermission(CreatePermissionRequest request) {
        String code = request.code().trim().toLowerCase(Locale.ROOT);
        if (permissionRepository.findByCode(code).isPresent()) {
            throw new BusinessException("PERMISSION_EXISTS", "Permission already exists: " + code, HttpStatus.CONFLICT);
        }
        Permission permission = new Permission();
        permission.setCode(code);
        permission.setDescription(trimToNull(request.description()));
        permissionRepository.save(permission);
        auditRecorder.record(AuditRecord.builder("ADMIN_PERMISSION_CREATE")
                .entity("Permission:" + permission.getId())
                .newValue(code)
                .build());
        return toPermissionResponse(permission);
    }

    @Transactional(readOnly = true)
    public List<RoleResponse> listRoles() {
        return roleRepository.findAll().stream()
                .sorted(Comparator.comparing(Role::getCode))
                .map(this::toRoleResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public RoleResponse getRole(String code) {
        return toRoleResponse(requireRole(code));
    }

    @Transactional
    public RoleResponse createRole(CreateRoleRequest request) {
        String code = request.code().trim().toUpperCase(Locale.ROOT);
        if (roleRepository.findByCode(code).isPresent()) {
            throw new BusinessException("ROLE_EXISTS", "Role already exists: " + code, HttpStatus.CONFLICT);
        }
        Set<Permission> permissions = resolvePermissions(request.permissionCodes());
        Role role = new Role();
        role.setCode(code);
        role.setName(request.name().trim());
        role.setDescription(trimToNull(request.description()));
        role.setPermissions(permissions);
        roleRepository.save(role);
        auditRecorder.record(AuditRecord.builder("ADMIN_ROLE_CREATE")
                .entity("Role:" + role.getId())
                .newValue(code + ";perms=" + permissionCodesOf(role))
                .build());
        return toRoleResponse(role);
    }

    @Transactional
    public RoleResponse updateRole(String code, UpdateRoleRequest request) {
        Role role = requireRole(code);
        String oldValue = role.getCode() + ";name=" + role.getName() + ";perms=" + permissionCodesOf(role);

        if (request.name() != null && !request.name().isBlank()) {
            role.setName(request.name().trim());
        }
        if (request.description() != null) {
            role.setDescription(trimToNull(request.description()));
        }
        if (request.permissionCodes() != null) {
            Set<Permission> permissions = resolvePermissions(request.permissionCodes());
            if (SUPER_ADMIN_CODE.equals(role.getCode())
                    && permissions.stream().noneMatch(p -> ADMIN_MANAGE_PERMISSION.equals(p.getCode()))) {
                throw new BusinessException(
                        "SUPER_ADMIN_LOCKED",
                        "SUPER_ADMIN must retain " + ADMIN_MANAGE_PERMISSION,
                        HttpStatus.BAD_REQUEST);
            }
            role.setPermissions(permissions);
        }
        roleRepository.save(role);
        auditRecorder.record(AuditRecord.builder("ADMIN_ROLE_UPDATE")
                .entity("Role:" + role.getId())
                .oldValue(oldValue)
                .newValue(role.getCode() + ";name=" + role.getName() + ";perms=" + permissionCodesOf(role))
                .build());
        return toRoleResponse(role);
    }

    private Set<Role> resolveRoles(List<String> roleCodes) {
        if (roleCodes == null || roleCodes.isEmpty()) {
            throw new BusinessException("ADMIN_ROLES_REQUIRED", "At least one roleCode required", HttpStatus.BAD_REQUEST);
        }
        Set<Role> roles = new HashSet<>();
        for (String code : roleCodes) {
            roles.add(requireRole(code));
        }
        return roles;
    }

    private Set<Permission> resolvePermissions(List<String> permissionCodes) {
        if (permissionCodes == null || permissionCodes.isEmpty()) {
            throw new BusinessException(
                    "ADMIN_PERMISSIONS_REQUIRED",
                    "At least one permissionCode required",
                    HttpStatus.BAD_REQUEST);
        }
        Set<Permission> permissions = new HashSet<>();
        for (String code : permissionCodes) {
            String normalized = code.trim().toLowerCase(Locale.ROOT);
            Permission permission = permissionRepository.findByCode(normalized)
                    .orElseThrow(() -> new ResourceNotFoundException("Permission not found: " + code));
            permissions.add(permission);
        }
        return permissions;
    }

    private Role requireRole(String code) {
        String normalized = code.trim().toUpperCase(Locale.ROOT);
        return roleRepository.findByCode(normalized)
                .orElseThrow(() -> new ResourceNotFoundException("Role not found: " + code));
    }

    private AdminUserResponse toAdminResponse(AdminUser adminUser) {
        return new AdminUserResponse(
                adminUser.getId(),
                adminUser.getUserId(),
                adminUser.isEnabled(),
                roleCodesOf(adminUser));
    }

    private RoleResponse toRoleResponse(Role role) {
        return new RoleResponse(
                role.getId(),
                role.getCode(),
                role.getName(),
                role.getDescription(),
                permissionCodesOf(role),
                role.getCreatedAt());
    }

    private PermissionResponse toPermissionResponse(Permission permission) {
        return new PermissionResponse(
                permission.getId(),
                permission.getCode(),
                permission.getDescription(),
                permission.getCreatedAt());
    }

    private static Set<String> roleCodesOf(AdminUser adminUser) {
        return adminUser.getRoles().stream()
                .map(Role::getCode)
                .collect(Collectors.toCollection(java.util.TreeSet::new));
    }

    private static Set<String> permissionCodesOf(Role role) {
        return role.getPermissions().stream()
                .map(Permission::getCode)
                .collect(Collectors.toCollection(java.util.TreeSet::new));
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static UserPrincipal currentPrincipal() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof UserPrincipal principal)) {
            throw new BusinessException("UNAUTHENTICATED", "Authentication required", HttpStatus.UNAUTHORIZED);
        }
        return principal;
    }
}
