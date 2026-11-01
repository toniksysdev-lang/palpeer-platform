package com.palpeer.admin.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.palpeer.admin.security.AdminIpAllowlistFilter;
import com.palpeer.admin.security.AdminMfaEnrollmentFilter;
import com.palpeer.admin.service.AdminMfaService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(AdminSecurityProperties.class)
public class AdminModuleConfig {

    @Bean
    public AdminMfaEnrollmentFilter adminMfaEnrollmentFilter(
            AdminMfaService adminMfaService, ObjectMapper objectMapper) {
        return new AdminMfaEnrollmentFilter(adminMfaService, objectMapper);
    }

    @Bean
    public AdminIpAllowlistFilter adminIpAllowlistFilter(
            ObjectMapper objectMapper,
            @Value("${palpeer.security.admin-ip-allowlist:}") String allowlistCsv) {
        return new AdminIpAllowlistFilter(objectMapper, allowlistCsv);
    }
}
