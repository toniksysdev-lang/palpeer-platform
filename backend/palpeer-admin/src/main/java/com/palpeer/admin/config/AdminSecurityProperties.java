package com.palpeer.admin.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Getter
@Setter
@ConfigurationProperties(prefix = "palpeer.admin")
public class AdminSecurityProperties {

    /**
     * When true, enabled admins without TOTP enrollment cannot call admin APIs (except MFA setup
     * and {@code /admin/me}).
     */
    private boolean mfaRequired = false;

    private String bootstrapEmail = "";
}
