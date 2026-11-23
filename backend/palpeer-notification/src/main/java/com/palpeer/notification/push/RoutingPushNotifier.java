package com.palpeer.notification.push;

import com.palpeer.notification.domain.DeviceToken;
import com.palpeer.notification.domain.DeviceTokenPlatform;
import com.palpeer.notification.domain.Notification;
import com.palpeer.notification.repository.DeviceTokenRepository;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Routes device tokens to Expo or a native fallback (FCM or logging) based on token format.
 */
@Slf4j
@RequiredArgsConstructor
public class RoutingPushNotifier implements PushNotifier {

    private static final Pattern RAW_APNS_HEX = Pattern.compile("(?i)^[0-9a-f]{64}$");

    private final ExpoPushNotifier expoPushNotifier;
    private final PushNotifier nativeFallback;
    private final DeviceTokenRepository deviceTokenRepository;

    @Override
    public void send(DeviceToken deviceToken, Notification notification) {
        if (ExpoPushNotifier.isExpoToken(deviceToken.getToken())) {
            expoPushNotifier.send(deviceToken, notification);
            return;
        }
        // Legacy rows: raw APNs hex registered before we rejected them at ingest.
        if (isRawApnsToken(deviceToken)) {
            log.warn(
                    "Skipping undeliverable raw APNs token id={} platform={} notificationId={}",
                    deviceToken.getId(),
                    deviceToken.getPlatform(),
                    notification.getId());
            disableQuietly(deviceToken);
            throw new RuntimeException(
                    "Push skipped: raw APNs token is not a valid FCM registration token");
        }
        nativeFallback.send(deviceToken, notification);
    }

    private static boolean isRawApnsToken(DeviceToken deviceToken) {
        if (deviceToken.getPlatform() != DeviceTokenPlatform.IOS) {
            return false;
        }
        String token = deviceToken.getToken();
        if (token == null || token.isBlank()) {
            return false;
        }
        return RAW_APNS_HEX.matcher(token.trim().replaceAll("\\s+", "")).matches();
    }

    private void disableQuietly(DeviceToken deviceToken) {
        try {
            deviceToken.setEnabled(false);
            deviceTokenRepository.save(deviceToken);
        } catch (RuntimeException ex) {
            log.warn("Failed to disable undeliverable token {}: {}", deviceToken.getId(), ex.getMessage());
        }
    }
}
