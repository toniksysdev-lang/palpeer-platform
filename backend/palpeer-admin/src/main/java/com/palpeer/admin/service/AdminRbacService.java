package com.palpeer.admin.service;

import com.palpeer.admin.domain.AdminUser;
import com.palpeer.admin.domain.Permission;
import com.palpeer.admin.domain.Role;
import com.palpeer.admin.repository.AdminMfaTotpRepository;
import com.palpeer.admin.repository.AdminUserRepository;
import com.palpeer.admin.repository.PermissionRepository;
import com.palpeer.admin.repository.RoleRepository;
import com.palpeer.admin.web.dto.AdminMeResponse;
import com.palpeer.admin.web.dto.AdminUserResponse;
import com.palpeer.admin.web.dto.AssignAdminRequest;
import com.palpeer.admin.web.dto.CreateAdminRequest;
import com.palpeer.admin.web.dto.CreateAdminResponse;
import com.palpeer.admin.web.dto.CreatePermissionRequest;
import com.palpeer.admin.web.dto.CreateRoleRequest;
import com.palpeer.admin.web.dto.PermissionResponse;
import com.palpeer.admin.web.dto.RoleResponse;
import com.palpeer.admin.web.dto.UpdateAdminRequest;
import com.palpeer.admin.web.dto.UpdateRoleRequest;
import com.palpeer.auth.security.UserPrincipal;
import com.palpeer.common.audit.AuditRecord;
import com.palpeer.common.audit.AuditRecorder;
import com.palpeer.common.exception.BusinessException;
import com.palpeer.common.exception.ResourceNotFoundException;
import com.palpeer.common.mail.EmailSender;
import com.palpeer.common.mail.PalpeerEmailTemplates;
import com.palpeer.profile.domain.Profile;
import com.palpeer.profile.repository.ProfileRepository;
import com.palpeer.user.UsernameRules;
import com.palpeer.user.domain.User;
import com.palpeer.user.domain.UserStatus;
import com.palpeer.user.repository.UserRepository;
import java.security.SecureRandom;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class AdminRbacService {

    public static final String SUPER_ADMIN_CODE = "SUPER_ADMIN";
    public static final String ADMIN_MANAGE_PERMISSION = "admin:manage";

    private static final char[] TEMP_PASSWORD_ALPHABET =
            "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%".toCharArray();
    private static final SecureRandom RANDOM = new SecureRandom();

    private final AdminUserRepository adminUserRepository;
    private final AdminMfaTotpRepository adminMfaTotpRepository;
    private final AdminMfaService adminMfaService;
    private final RoleRepository roleRepository;
    private final PermissionRepository permissionRepository;
    private final UserRepository userRepository;
    private final ProfileRepository profileRepository;
    private final AuditRecorder auditRecorder;
    private final PasswordEncoder passwordEncoder;
    private final EmailSender emailSender;

    @Transactional
    public CreateAdminResponse create(CreateAdminRequest request) {
        String email = request.email().trim().toLowerCase(Locale.ROOT);
        Set<Role> roles = resolveRoles(request.roleCodes());
        boolean sendInvite = request.sendInviteEmail() == null || Boolean.TRUE.equals(request.sendInviteEmail());

        String temporaryPassword = resolveTemporaryPassword(request.password());
        User user = userRepository
                .findByEmailIgnoreCase(email)
                .orElseGet(() -> createPlatformUser(email, temporaryPassword));

        if (adminUserRepository.existsByUserId(user.getId())) {
            throw new BusinessException(
                    "ADMIN_EXISTS",
                    "An admin operator already exists for this email. Edit the existing account instead.",
                    HttpStatus.CONFLICT);
        }

        // Ensure password login works for the console (existing Google-only users included).
        user.setPasswordHash(passwordEncoder.encode(temporaryPassword));
        user.setEmailVerified(true);
        user.setEnabled(true);
        if (user.getStatus() == UserStatus.PENDING_VERIFICATION || user.getStatus() == null) {
            user.setStatus(UserStatus.ACTIVE);
        }
        userRepository.save(user);
        upsertProfileNames(user.getId(), request.firstName(), request.lastName());

        AdminUser adminUser = new AdminUser();
        adminUser.setUserId(user.getId());
        adminUser.setEnabled(true);
        adminUser.setRoles(roles);
        adminUserRepository.save(adminUser);

        auditRecorder.record(AuditRecord.builder("ADMIN_CREATE")
                .entity("AdminUser:" + adminUser.getId())
                .userRef(user.getId())
                .newValue("email="
                        + email
                        + ";name="
                        + request.firstName().trim()
                        + " "
                        + request.lastName().trim()
                        + ";roles="
                        + roleCodesOf(adminUser))
                .build());

        boolean emailed = false;
        if (sendInvite) {
            emailed = sendAdminInvite(email, temporaryPassword);
        }

        return new CreateAdminResponse(toAdminResponse(adminUser), temporaryPassword, emailed);
    }

    @Transactional
    public AdminUserResponse update(UUID userId, UpdateAdminRequest request) {
        AdminUser adminUser = adminUserRepository
                .findByUserId(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Admin user not found"));
        String oldValue = "enabled=" + adminUser.isEnabled() + ";roles=" + roleCodesOf(adminUser);

        if (request.roleCodes() != null) {
            adminUser.setRoles(resolveRoles(request.roleCodes()));
        }
        if (request.enabled() != null) {
            if (Boolean.FALSE.equals(request.enabled())) {
                ensureNotSelf(userId);
                ensureNotLastManageAdmin(adminUser);
            }
            adminUser.setEnabled(request.enabled());
        }
        adminUserRepository.save(adminUser);

        String temporaryPassword = null;
        boolean emailed = false;
        if (Boolean.TRUE.equals(request.resetPassword())) {
            temporaryPassword = generateTemporaryPassword();
            User user = userRepository
                    .findById(userId)
                    .orElseThrow(() -> new ResourceNotFoundException("User not found"));
            user.setPasswordHash(passwordEncoder.encode(temporaryPassword));
            userRepository.save(user);
            String email = user.getEmail();
            emailed = sendAdminInvite(email, temporaryPassword);
        }

        auditRecorder.record(AuditRecord.builder("ADMIN_UPDATE")
                .entity("AdminUser:" + adminUser.getId())
                .userRef(userId)
                .oldValue(oldValue)
                .newValue("enabled="
                        + adminUser.isEnabled()
                        + ";roles="
                        + roleCodesOf(adminUser)
                        + ";passwordReset="
                        + Boolean.TRUE.equals(request.resetPassword())
                        + ";inviteEmailSent="
                        + emailed)
                .build());

        // Password is only returned on create; updates email it when resetPassword=true.
        return toAdminResponse(adminUser);
    }

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
        ensureNotSelf(userId);
        AdminUser adminUser = adminUserRepository.findByUserId(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Admin user not found"));
        ensureNotLastManageAdmin(adminUser);
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

    @Transactional
    public void delete(UUID userId) {
        ensureNotSelf(userId);
        AdminUser adminUser = adminUserRepository
                .findByUserId(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Admin user not found"));
        ensureNotLastManageAdmin(adminUser);
        adminMfaTotpRepository.findByUserId(userId).ifPresent(adminMfaTotpRepository::delete);
        String entityId = String.valueOf(adminUser.getId());
        adminUserRepository.delete(adminUser);
        auditRecorder.record(AuditRecord.builder("ADMIN_DELETE")
                .entity("AdminUser:" + entityId)
                .userRef(userId)
                .newValue("deleted=true")
                .build());
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
        boolean mfaEnabled = adminMfaTotpRepository.existsByUserIdAndEnabledTrue(adminUser.getUserId());
        boolean mfaEnrollmentRequired = adminMfaService.isEnrollmentRequired(adminUser.getUserId());
        return new AdminMeResponse(
                adminUser.getUserId(),
                principal.getEmail(),
                adminUser.isEnabled(),
                roleCodesOf(adminUser),
                permissionCodes,
                mfaEnabled,
                mfaEnrollmentRequired);
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
        String email = userRepository
                .findById(adminUser.getUserId())
                .map(User::getEmail)
                .orElse(null);
        Profile profile = profileRepository.findByUserId(adminUser.getUserId()).orElse(null);
        return new AdminUserResponse(
                adminUser.getId(),
                adminUser.getUserId(),
                email,
                profile != null ? profile.getFirstName() : null,
                profile != null ? profile.getLastName() : null,
                adminUser.isEnabled(),
                roleCodesOf(adminUser));
    }

    private void upsertProfileNames(UUID userId, String firstName, String lastName) {
        Profile profile = profileRepository.findByUserId(userId).orElseGet(() -> {
            Profile created = new Profile();
            created.setUserId(userId);
            return created;
        });
        profile.setFirstName(trimToNull(firstName));
        profile.setLastName(trimToNull(lastName));
        profileRepository.save(profile);
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

    private User createPlatformUser(String email, String temporaryPassword) {
        User user = new User();
        user.setEmail(email);
        user.setUsername(allocateUsername(email));
        // Password hash is set by the caller immediately after create.
        user.setPasswordHash(passwordEncoder.encode(temporaryPassword));
        user.setStatus(UserStatus.ACTIVE);
        user.setEnabled(true);
        user.setEmailVerified(true);
        user.setPhoneVerified(false);
        user.setFailedLoginAttempts(0);
        return userRepository.save(user);
    }

    private String allocateUsername(String email) {
        String base = UsernameRules.fromEmail(email);
        if (base.length() < UsernameRules.MIN_LENGTH) {
            base = "admin";
        }
        if (base.length() > 24) {
            base = base.substring(0, 24);
        }
        String candidate = base;
        int attempt = 0;
        while (userRepository.existsByUsernameIgnoreCase(candidate)) {
            attempt++;
            String suffix = "_" + Integer.toString(attempt, 36);
            candidate = base.substring(0, Math.min(base.length(), UsernameRules.MAX_LENGTH - suffix.length()))
                    + suffix;
            if (attempt > 500) {
                candidate = "admin_" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
                break;
            }
        }
        return UsernameRules.requireValid(candidate);
    }

    private String resolveTemporaryPassword(String requested) {
        if (requested != null && !requested.isBlank()) {
            String trimmed = requested.trim();
            if (trimmed.length() < 8) {
                throw new BusinessException(
                        "INVALID_PASSWORD", "Password must be at least 8 characters", HttpStatus.BAD_REQUEST);
            }
            return trimmed;
        }
        return generateTemporaryPassword();
    }

    private static String generateTemporaryPassword() {
        StringBuilder sb = new StringBuilder(16);
        for (int i = 0; i < 16; i++) {
            sb.append(TEMP_PASSWORD_ALPHABET[RANDOM.nextInt(TEMP_PASSWORD_ALPHABET.length)]);
        }
        return sb.toString();
    }

    private boolean sendAdminInvite(String email, String temporaryPassword) {
        try {
            var rendered = PalpeerEmailTemplates.adminInvite(email, temporaryPassword);
            emailSender.send(email, rendered.subject(), rendered.text(), rendered.html());
            return true;
        } catch (Exception ex) {
            log.warn("Failed to send admin invite email to {}: {}", email, ex.toString());
            return false;
        }
    }

    private void ensureNotSelf(UUID userId) {
        UserPrincipal principal = currentPrincipal();
        if (principal.getId().equals(userId)) {
            throw new BusinessException(
                    "ADMIN_SELF_ACTION",
                    "You cannot disable or delete your own admin account",
                    HttpStatus.BAD_REQUEST);
        }
    }

    private void ensureNotLastManageAdmin(AdminUser target) {
        if (!target.isEnabled()) {
            return;
        }
        boolean targetCanManage = target.getRoles().stream()
                .flatMap(role -> role.getPermissions().stream())
                .anyMatch(p -> ADMIN_MANAGE_PERMISSION.equals(p.getCode()));
        if (!targetCanManage) {
            return;
        }
        long otherManageAdmins = adminUserRepository.findAll().stream()
                .filter(AdminUser::isEnabled)
                .filter(row -> !row.getUserId().equals(target.getUserId()))
                .filter(row -> row.getRoles().stream()
                        .flatMap(role -> role.getPermissions().stream())
                        .anyMatch(p -> ADMIN_MANAGE_PERMISSION.equals(p.getCode())))
                .count();
        if (otherManageAdmins == 0) {
            throw new BusinessException(
                    "LAST_ADMIN_MANAGE",
                    "Cannot remove the last enabled admin with " + ADMIN_MANAGE_PERMISSION,
                    HttpStatus.BAD_REQUEST);
        }
    }
}
