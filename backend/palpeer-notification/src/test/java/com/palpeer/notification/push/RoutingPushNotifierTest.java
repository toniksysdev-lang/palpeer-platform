package com.palpeer.notification.push;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import com.palpeer.notification.domain.DeviceToken;
import com.palpeer.notification.domain.DeviceTokenPlatform;
import com.palpeer.notification.domain.Notification;
import com.palpeer.notification.repository.DeviceTokenRepository;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class RoutingPushNotifierTest {

    @Test
    void routesExpoTokenToExpoNotifier() {
        ExpoPushNotifier expo = mock(ExpoPushNotifier.class);
        PushNotifier nativeFallback = mock(PushNotifier.class);
        DeviceTokenRepository repo = mock(DeviceTokenRepository.class);
        RoutingPushNotifier routing = new RoutingPushNotifier(expo, nativeFallback, repo);

        DeviceToken token = token("ExponentPushToken[abc]", DeviceTokenPlatform.IOS);
        Notification notification = notification();

        routing.send(token, notification);

        verify(expo).send(token, notification);
        verifyNoInteractions(nativeFallback);
    }

    @Test
    void disablesAndRejectsRawApnsHex() {
        ExpoPushNotifier expo = mock(ExpoPushNotifier.class);
        PushNotifier nativeFallback = mock(PushNotifier.class);
        DeviceTokenRepository repo = mock(DeviceTokenRepository.class);
        RoutingPushNotifier routing = new RoutingPushNotifier(expo, nativeFallback, repo);

        DeviceToken token = token(
                "a1b2c3d4e5f60718293a4b5c6d7e8f90112233445566778899aabbccddeeff00",
                DeviceTokenPlatform.IOS);
        Notification notification = notification();

        assertThatThrownBy(() -> routing.send(token, notification))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("raw APNs");

        verify(repo).save(token);
        verify(nativeFallback, never()).send(any(), any());
        verifyNoInteractions(expo);
    }

    private static DeviceToken token(String value, DeviceTokenPlatform platform) {
        DeviceToken token = new DeviceToken();
        token.setId(UUID.randomUUID());
        token.setToken(value);
        token.setPlatform(platform);
        token.setEnabled(true);
        return token;
    }

    private static Notification notification() {
        Notification notification = new Notification();
        notification.setId(UUID.randomUUID());
        notification.setUserId(UUID.randomUUID());
        notification.setTitle("t");
        notification.setBody("b");
        return notification;
    }
}
