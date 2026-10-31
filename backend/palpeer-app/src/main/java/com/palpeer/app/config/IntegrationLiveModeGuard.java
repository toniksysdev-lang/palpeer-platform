package com.palpeer.app.config;

import com.palpeer.kyc.config.ComplyCubeProperties;
import com.palpeer.wallet.provider.kuda.KudaProperties;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

/**
 * Loud startup checks so sandbox/test vendor keys cannot silently break Live KYC/payments.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class IntegrationLiveModeGuard implements ApplicationRunner {

    private final Environment environment;
    private final ComplyCubeProperties complyCubeProperties;
    private final KudaProperties kudaProperties;

    @Override
    public void run(ApplicationArguments args) {
        List<String> problems = new ArrayList<>();

        if (complyCubeProperties.isEnabled()) {
            String apiKey = blankToEmpty(complyCubeProperties.getApiKey()).trim();
            if (apiKey.isEmpty()) {
                problems.add("COMPLYCUBE_ENABLED=true but COMPLYCUBE_API_KEY is blank");
            } else if (apiKey.toLowerCase(Locale.ROOT).startsWith("test_")) {
                problems.add(
                        "COMPLYCUBE_API_KEY is a test_ key — Live ComplyCube will not receive KYC submissions; set the live_ API key");
            }
            if (blankToEmpty(complyCubeProperties.getWebhookSecret()).isBlank()) {
                problems.add("COMPLYCUBE_WEBHOOK_SECRET is blank — check result webhooks will be rejected");
            }
        }

        if (kudaProperties.isEnabled()) {
            if (kudaProperties.isSandbox()) {
                problems.add(
                        "KUDA_SANDBOX=true — OpenAPI calls use UAT; set KUDA_SANDBOX=false for Live Kuda");
            }
            String baseUrl = blankToEmpty(kudaProperties.getBaseUrl()).toLowerCase(Locale.ROOT);
            if (baseUrl.contains("kuda-openapi-uat") || baseUrl.contains("uat.kudabank")) {
                problems.add(
                        "KUDA_BASE_URL points at UAT — clear it or set https://kuda-openapi.kuda.com/v2.1 for Live");
            }
            if (kudaProperties.isOfflineSandboxSettle() && !kudaProperties.isSandbox()) {
                problems.add("KUDA_OFFLINE_SANDBOX_SETTLE should be false when Live (sandbox=false)");
            }
            if (!kudaProperties.isSandbox()
                    && blankToEmpty(kudaProperties.getClientAccountNumber()).isBlank()) {
                problems.add(
                        "KUDA_CLIENT_ACCOUNT_NUMBER is blank — Live withdrawals and dynamic remitting require the main account number");
            }
            boolean hasUserPass = !blankToEmpty(kudaProperties.getWebhookUsername()).isBlank()
                    && !blankToEmpty(kudaProperties.getWebhookPassword()).isBlank();
            boolean hasHmac = !blankToEmpty(kudaProperties.getWebhookSecret()).isBlank();
            if (!hasUserPass && !hasHmac) {
                problems.add(
                        "Kuda webhooks unauthenticated — set KUDA_WEBHOOK_USERNAME/PASSWORD (preferred) or KUDA_WEBHOOK_SECRET");
            }
        }

        if (problems.isEmpty()) {
            return;
        }

        boolean productionLike = isProductionLike();
        for (String problem : problems) {
            if (productionLike) {
                log.error("Integration Live misconfiguration: {}", problem);
            } else {
                log.warn("Integration Live misconfiguration: {}", problem);
            }
        }
        if (productionLike) {
            log.error(
                    "Fix COMPLYCUBE_* / KUDA_* Live env on this host, then redeploy. KYC and NGN payments will fail until then.");
        }
    }

    private boolean isProductionLike() {
        String publicApi = blankToEmpty(environment.getProperty("PUBLIC_API_BASE_URL")).toLowerCase(Locale.ROOT);
        if (publicApi.contains("onrender.com") || publicApi.contains("palpeer")) {
            return true;
        }
        for (String profile : environment.getActiveProfiles()) {
            if ("prod".equalsIgnoreCase(profile) || "production".equalsIgnoreCase(profile)) {
                return true;
            }
        }
        return false;
    }

    private static String blankToEmpty(String value) {
        return value == null ? "" : value;
    }
}
