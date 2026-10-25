package com.palpeer.notification.push;

import com.palpeer.notification.domain.DeviceToken;
import com.palpeer.notification.domain.Notification;

/**
 * Push delivery adapter.
 * Active implementation: {@link RoutingPushNotifier} (Expo + FCM when credentials are present;
 * Expo + logging stub for native tokens when FCM is off).
 */
public interface PushNotifier {

    void send(DeviceToken deviceToken, Notification notification);
}
