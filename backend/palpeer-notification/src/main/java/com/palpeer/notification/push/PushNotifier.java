package com.palpeer.notification.push;

import com.palpeer.notification.domain.DeviceToken;
import com.palpeer.notification.domain.Notification;

/**
 * Push delivery adapter.
 * CONTRACT_PENDING (P12-05): FCM / APNs / web-push provider and payload schema.
 */
public interface PushNotifier {

    void send(DeviceToken deviceToken, Notification notification);
}
