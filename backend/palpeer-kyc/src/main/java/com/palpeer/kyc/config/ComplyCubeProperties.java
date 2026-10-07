package com.palpeer.kyc.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Getter
@Setter
@ConfigurationProperties(prefix = "palpeer.complycube")
public class ComplyCubeProperties {

    /**
     * When false, KYC stays local-only (uploads + admin review).
     */
    private boolean enabled = false;

    private String apiKey = "";

    private String baseUrl = "https://api.complycube.com/v1";

    /**
     * Webhook signing secret from the ComplyCube portal.
     */
    private String webhookSecret = "";
}
