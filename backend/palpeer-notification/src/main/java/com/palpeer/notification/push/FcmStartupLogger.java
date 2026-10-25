package com.palpeer.notification.push;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

/** Logs clear guidance when FCM is requested but credentials are missing. */
@Slf4j
@Component
@RequiredArgsConstructor
public class FcmStartupLogger {

    private final FcmProperties properties;

    @PostConstruct
    void logFcmStatus() {
        if (!properties.isEnabled()) {
            log.info(
                    "FCM disabled (PALPEER_FCM_ENABLED=false) — Expo tokens still deliver via Expo Push; native tokens are logged only");
            return;
        }
        boolean hasCreds =
                StringUtils.hasText(properties.getCredentialsJson())
                        || StringUtils.hasText(properties.getCredentialsFile());
        if (hasCreds) {
            log.info("FCM enabled with credentials — Firebase Admin will deliver pushes");
        } else {
            log.warn(
                    "PALPEER_FCM_ENABLED=true but no credentials — set PALPEER_FCM_CREDENTIALS_JSON"
                            + " (or CREDENTIALS_FILE). Push delivery remains a logging stub until then.");
        }
    }
}
