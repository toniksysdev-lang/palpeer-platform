package com.palpeer.notification.push;

import com.palpeer.notification.domain.DeviceToken;
import com.palpeer.notification.domain.Notification;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Dev/stub push delivery when FCM is disabled ({@code palpeer.fcm.enabled=false}).
 */
@Slf4j
@Component
@ConditionalOnProperty(prefix = "palpeer.fcm", name = "enabled", havingValue = "false", matchIfMissing = true)
public class LoggingPushNotifier implements PushNotifier {

    @Override
    public void send(DeviceToken deviceToken, Notification notification) {
        log.info(
                "PUSH stub → user={} platform={} tokenEnding={} notificationId={} title={} data={}",
                notification.getUserId(),
                deviceToken.getPlatform(),
                mask(deviceToken.getToken()),
                notification.getId(),
                notification.getTitle(),
                FcmPushNotifier.buildData(notification));
    }

    private static String mask(String token) {
        if (token == null || token.length() < 8) {
            return "****";
        }
        return "…" + token.substring(token.length() - 6);
    }
}
