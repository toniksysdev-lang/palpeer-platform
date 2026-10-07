package com.palpeer.admin.config;

import com.palpeer.admin.domain.AdminUser;
import com.palpeer.admin.domain.Role;
import com.palpeer.admin.repository.AdminUserRepository;
import com.palpeer.admin.repository.RoleRepository;
import com.palpeer.common.audit.AuditRecord;
import com.palpeer.common.audit.AuditRecorder;
import com.palpeer.user.repository.UserRepository;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Optional first-admin bootstrap via email.
 * CONTRACT_PENDING (P15-03): production bootstrap / invite flow.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AdminBootstrapRunner implements ApplicationRunner {

    private final UserRepository userRepository;
    private final AdminUserRepository adminUserRepository;
    private final RoleRepository roleRepository;
    private final AuditRecorder auditRecorder;

    @Value("${palpeer.admin.bootstrap-email:}")
    private String bootstrapEmail;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (bootstrapEmail == null || bootstrapEmail.isBlank()) {
            return;
        }
        if (adminUserRepository.countByEnabledTrue() > 0) {
            return;
        }
        userRepository.findByEmailIgnoreCase(bootstrapEmail.trim()).ifPresentOrElse(user -> {
            Role superAdmin = roleRepository.findByCode("SUPER_ADMIN")
                    .orElseThrow(() -> new IllegalStateException("SUPER_ADMIN role missing — run Flyway V19"));
            AdminUser adminUser = new AdminUser();
            adminUser.setUserId(user.getId());
            adminUser.setEnabled(true);
            adminUser.setRoles(Set.of(superAdmin));
            adminUserRepository.save(adminUser);
            auditRecorder.record(AuditRecord.builder("ADMIN_BOOTSTRAP")
                    .entity("AdminUser:" + adminUser.getId())
                    .userRef(user.getId())
                    .newValue("role=SUPER_ADMIN;email=" + bootstrapEmail)
                    .build());
            log.warn("Bootstrapped SUPER_ADMIN for email={}", bootstrapEmail);
        }, () -> log.warn("Admin bootstrap email not found as user: {}", bootstrapEmail));
    }
}
