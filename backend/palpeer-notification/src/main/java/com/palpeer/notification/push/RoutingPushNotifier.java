package com.palpeer.notification.push;

import com.palpeer.notification.domain.DeviceToken;
import com.palpeer.notification.domain.Notification;
import lombok.RequiredArgsConstructor;

/**
 * Routes device tokens to Expo or FCM based on token format.
 */
@RequiredArgsConstructor
public class RoutingPushNotifier implements PushNotifier {

    private final ExpoPushNotifier expoPushNotifier;
    private final FcmPushNotifier fcmPushNotifier;

    @Override
    public void send(DeviceToken deviceToken, Notification notification) {
        if (ExpoPushNotifier.isExpoToken(deviceToken.getToken())) {
            expoPushNotifier.send(deviceToken, notification);
        } else {
            fcmPushNotifier.send(deviceToken, notification);
        }
    }
}
