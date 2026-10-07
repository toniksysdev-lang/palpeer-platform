package com.palpeer.notification.push;

import com.palpeer.notification.domain.DeviceToken;
import com.palpeer.notification.domain.Notification;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * Dev/stub push delivery — logs only until a real provider is wired (P12-05).
 */
@Slf4j
@Component
public class LoggingPushNotifier implements PushNotifier {

    @Override
    public void send(DeviceToken deviceToken, Notification notification) {
        log.info(
                "PUSH stub → user={} platform={} tokenEnding={} notificationId={} title={}",
                notification.getUserId(),
                deviceToken.getPlatform(),
                mask(deviceToken.getToken()),
                notification.getId(),
                notification.getTitle());
    }

    private static String mask(String token) {
        if (token == null || token.length() < 8) {
            return "****";
        }
        return "…" + token.substring(token.length() - 6);
    }
}
