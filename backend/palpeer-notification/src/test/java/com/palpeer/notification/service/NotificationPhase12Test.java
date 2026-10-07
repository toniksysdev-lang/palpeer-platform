package com.palpeer.notification.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.palpeer.common.exception.ResourceNotFoundException;
import com.palpeer.common.mail.EmailSender;
import com.palpeer.notification.domain.DeviceToken;
import com.palpeer.notification.domain.DeviceTokenPlatform;
import com.palpeer.notification.domain.Notification;
import com.palpeer.notification.domain.NotificationChannel;
import com.palpeer.notification.domain.NotificationStatus;
import com.palpeer.notification.push.PushNotifier;
import com.palpeer.notification.repository.DeviceTokenRepository;
import com.palpeer.notification.repository.NotificationRepository;
import com.palpeer.notification.web.dto.CreateNotificationRequest;
import com.palpeer.notification.web.dto.DeviceTokenResponse;
import com.palpeer.notification.web.dto.NotificationResponse;
import com.palpeer.notification.web.dto.RegisterDeviceTokenRequest;
import com.palpeer.user.repository.UserRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class NotificationPhase12Test {

    @Mock private DeviceTokenRepository deviceTokenRepository;
    @Mock private NotificationRepository notificationRepository;
    @Mock private PushNotifier pushNotifier;
    @Mock private EmailSender emailSender;
    @Mock private UserRepository userRepository;

    @InjectMocks private DeviceTokenService deviceTokenService;
    @InjectMocks private NotificationService notificationService;

    @Test
    void registerDeviceToken_upsertsByToken() {
        UUID userId = UUID.randomUUID();
        when(deviceTokenRepository.findByToken("tok-1")).thenReturn(Optional.empty());
        when(deviceTokenRepository.save(any(DeviceToken.class))).thenAnswer(inv -> {
            DeviceToken t = inv.getArgument(0);
            t.setId(UUID.randomUUID());
            return t;
        });

        DeviceTokenResponse response = deviceTokenService.register(
                userId, new RegisterDeviceTokenRequest("tok-1", DeviceTokenPlatform.ANDROID, "pixel-1"));

        assertThat(response.platform()).isEqualTo(DeviceTokenPlatform.ANDROID);
        assertThat(response.enabled()).isTrue();
        ArgumentCaptor<DeviceToken> captor = ArgumentCaptor.forClass(DeviceToken.class);
        verify(deviceTokenRepository).save(captor.capture());
        assertThat(captor.getValue().getUserId()).isEqualTo(userId);
        assertThat(captor.getValue().getToken()).isEqualTo("tok-1");
    }

    @Test
    void createInApp_marksSentWithoutPush() {
        UUID userId = UUID.randomUUID();
        when(notificationRepository.save(any(Notification.class))).thenAnswer(inv -> {
            Notification n = inv.getArgument(0);
            if (n.getId() == null) {
                n.setId(UUID.randomUUID());
            }
            return n;
        });

        NotificationResponse response = notificationService.create(
                userId,
                new CreateNotificationRequest("Hello", "Body", "SYSTEM", NotificationChannel.IN_APP, null, null));

        assertThat(response.status()).isEqualTo(NotificationStatus.SENT);
        verify(pushNotifier, never()).send(any(), any());
    }

    @Test
    void createPush_sendsToEnabledTokens() {
        UUID userId = UUID.randomUUID();
        DeviceToken token = new DeviceToken();
        token.setId(UUID.randomUUID());
        token.setUserId(userId);
        token.setToken("tok");
        token.setPlatform(DeviceTokenPlatform.IOS);
        token.setEnabled(true);

        when(notificationRepository.save(any(Notification.class))).thenAnswer(inv -> {
            Notification n = inv.getArgument(0);
            if (n.getId() == null) {
                n.setId(UUID.randomUUID());
            }
            return n;
        });
        when(deviceTokenRepository.findByUserIdAndEnabledTrue(userId)).thenReturn(List.of(token));

        NotificationResponse response = notificationService.create(
                userId,
                new CreateNotificationRequest("Alert", "Msg", "TX", NotificationChannel.PUSH, "FUNDING", UUID.randomUUID()));

        assertThat(response.status()).isEqualTo(NotificationStatus.SENT);
        verify(pushNotifier).send(any(DeviceToken.class), any(Notification.class));
    }

    @Test
    void createPush_failsWhenNoTokens() {
        UUID userId = UUID.randomUUID();
        when(notificationRepository.save(any(Notification.class))).thenAnswer(inv -> {
            Notification n = inv.getArgument(0);
            if (n.getId() == null) {
                n.setId(UUID.randomUUID());
            }
            return n;
        });
        when(deviceTokenRepository.findByUserIdAndEnabledTrue(userId)).thenReturn(List.of());

        NotificationResponse response = notificationService.create(
                userId,
                new CreateNotificationRequest("Alert", "Msg", null, NotificationChannel.PUSH, null, null));

        assertThat(response.status()).isEqualTo(NotificationStatus.FAILED);
        assertThat(response.failureReason()).contains("No enabled device tokens");
    }

    @Test
    void markRead_requiresOwner() {
        UUID userId = UUID.randomUUID();
        UUID notificationId = UUID.randomUUID();
        when(notificationRepository.findByIdAndUserId(notificationId, userId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> notificationService.markRead(userId, notificationId))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void get_requiresOwner() {
        UUID userId = UUID.randomUUID();
        UUID notificationId = UUID.randomUUID();
        when(notificationRepository.findByIdAndUserId(notificationId, userId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> notificationService.get(userId, notificationId))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void disableToken_requiresOwner() {
        UUID userId = UUID.randomUUID();
        UUID tokenId = UUID.randomUUID();
        when(deviceTokenRepository.findByIdAndUserId(tokenId, userId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> deviceTokenService.disable(userId, tokenId))
                .isInstanceOf(ResourceNotFoundException.class);
    }
}
