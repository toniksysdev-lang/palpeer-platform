package com.palpeer.notification.push;

import com.palpeer.notification.domain.DeviceToken;
import com.palpeer.notification.domain.Notification;

/**
 * Push delivery adapter.
 * Active implementation: {@link RoutingPushNotifier} (Expo + FCM) when FCM is enabled with
 * credentials; otherwise {@link LoggingPushNotifier}.
 */
public interface PushNotifier {

    void send(DeviceToken deviceToken, Notification notification);
}
