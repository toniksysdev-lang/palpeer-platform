package com.palpeer.notification.push;

import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.FirebaseMessagingException;
import com.google.firebase.messaging.Message;
import com.google.firebase.messaging.MessagingErrorCode;
import com.palpeer.notification.domain.DeviceToken;
import com.palpeer.notification.domain.Notification;
import com.palpeer.notification.repository.DeviceTokenRepository;
import java.util.HashMap;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Conditional;
import org.springframework.stereotype.Component;

/**
 * Delivers pushes via Firebase Cloud Messaging HTTP v1.
 * Data payload matches mobile {@code pushTarget}: notificationId, referenceType, referenceId.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "palpeer.fcm", name = "enabled", havingValue = "true")
@Conditional(FcmCredentialsPresentCondition.class)
public class FcmPushNotifier implements PushNotifier {

    private final FirebaseMessaging firebaseMessaging;
    private final DeviceTokenRepository deviceTokenRepository;

    @Override
    public void send(DeviceToken deviceToken, Notification notification) {
        Message message = Message.builder()
                .setToken(deviceToken.getToken())
                .setNotification(com.google.firebase.messaging.Notification.builder()
                        .setTitle(notification.getTitle())
                        .setBody(notification.getBody())
                        .build())
                .putAllData(buildData(notification))
                .build();

        try {
            String messageId = firebaseMessaging.send(message);
            log.debug(
                    "FCM sent messageId={} notificationId={} user={}",
                    messageId,
                    notification.getId(),
                    notification.getUserId());
        } catch (FirebaseMessagingException ex) {
            maybeDisableToken(deviceToken, ex);
            throw new RuntimeException(
                    "FCM send failed: " + ex.getMessagingErrorCode() + " " + ex.getMessage(), ex);
        }
    }

    static Map<String, String> buildData(Notification notification) {
        Map<String, String> data = new HashMap<>();
        if (notification.getId() != null) {
            data.put("notificationId", notification.getId().toString());
        }
        if (notification.getReferenceType() != null && !notification.getReferenceType().isBlank()) {
            data.put("referenceType", notification.getReferenceType());
        }
        if (notification.getReferenceId() != null) {
            data.put("referenceId", notification.getReferenceId().toString());
        }
        if (notification.getCategory() != null && !notification.getCategory().isBlank()) {
            data.put("category", notification.getCategory());
        }
        return data;
    }

    private void maybeDisableToken(DeviceToken deviceToken, FirebaseMessagingException ex) {
        MessagingErrorCode code = ex.getMessagingErrorCode();
        if (code == MessagingErrorCode.UNREGISTERED || code == MessagingErrorCode.INVALID_ARGUMENT) {
            deviceToken.setEnabled(false);
            deviceTokenRepository.save(deviceToken);
            log.warn(
                    "Disabled stale device token id={} platform={} reason={}",
                    deviceToken.getId(),
                    deviceToken.getPlatform(),
                    code);
        }
    }
}
