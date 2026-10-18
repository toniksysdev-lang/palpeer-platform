package com.palpeer.notification.push;

import com.palpeer.notification.domain.DeviceToken;
import com.palpeer.notification.domain.Notification;

/**
 * Push delivery adapter.
 * Active implementation: {@link FcmPushNotifier} when {@code palpeer.fcm.enabled=true},
 * otherwise {@link LoggingPushNotifier}.
 */
public interface PushNotifier {

    void send(DeviceToken deviceToken, Notification notification);
}
