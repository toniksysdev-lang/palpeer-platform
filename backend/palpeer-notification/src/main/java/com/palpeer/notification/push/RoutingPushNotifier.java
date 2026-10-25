package com.palpeer.notification.push;

import com.palpeer.notification.domain.DeviceToken;
import com.palpeer.notification.domain.Notification;
import lombok.RequiredArgsConstructor;

/**
 * Routes device tokens to Expo or a native fallback (FCM or logging) based on token format.
 */
@RequiredArgsConstructor
public class RoutingPushNotifier implements PushNotifier {

    private final ExpoPushNotifier expoPushNotifier;
    private final PushNotifier nativeFallback;

    @Override
    public void send(DeviceToken deviceToken, Notification notification) {
        if (ExpoPushNotifier.isExpoToken(deviceToken.getToken())) {
            expoPushNotifier.send(deviceToken, notification);
        } else {
            nativeFallback.send(deviceToken, notification);
        }
    }
}
