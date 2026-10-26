package com.palpeer.notification.push;

import static org.assertj.core.api.Assertions.assertThat;

import com.palpeer.notification.domain.Notification;
import com.palpeer.notification.domain.NotificationChannel;
import com.palpeer.notification.domain.NotificationStatus;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class FcmPushNotifierTest {

    @Test
    void buildData_includesNotificationIdAndReferences() {
        UUID id = UUID.randomUUID();
        UUID refId = UUID.randomUUID();
        Notification notification = new Notification();
        notification.setId(id);
        notification.setTitle("Funding successful");
        notification.setBody("Your funding was credited.");
        notification.setCategory("TRANSACTION");
        notification.setChannel(NotificationChannel.BOTH);
        notification.setStatus(NotificationStatus.PENDING);
        notification.setReferenceType("FUNDING");
        notification.setReferenceId(refId);

        Map<String, String> data = FcmPushNotifier.buildData(notification);

        assertThat(data)
                .containsEntry("notificationId", id.toString())
                .containsEntry("referenceType", "FUNDING")
                .containsEntry("referenceId", refId.toString())
                .containsEntry("category", "TRANSACTION");
    }

    @Test
    void buildData_omitsBlankOptionalFields() {
        Notification notification = new Notification();
        notification.setId(UUID.randomUUID());
        notification.setTitle("Hi");
        notification.setBody("Body");
        notification.setChannel(NotificationChannel.PUSH);
        notification.setStatus(NotificationStatus.PENDING);

        Map<String, String> data = FcmPushNotifier.buildData(notification);

        assertThat(data).containsOnlyKeys("notificationId");
    }

    @Test
    void buildData_addsDeepLinkForP2pRequest() {
        UUID id = UUID.randomUUID();
        UUID refId = UUID.randomUUID();
        Notification notification = new Notification();
        notification.setId(id);
        notification.setTitle("New P2P BUY");
        notification.setBody("Details");
        notification.setCategory("P2P");
        notification.setChannel(NotificationChannel.PUSH);
        notification.setStatus(NotificationStatus.PENDING);
        notification.setReferenceType("P2P_REQUEST");
        notification.setReferenceId(refId);

        Map<String, String> data = FcmPushNotifier.buildData(notification);

        assertThat(data)
                .containsEntry("deepLink", "palpeer://p2p/request/" + refId)
                .containsEntry("referenceType", "P2P_REQUEST")
                .containsEntry("referenceId", refId.toString());
    }
}
