package com.palpeer.notification.push;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.messaging.FirebaseMessaging;
import com.palpeer.common.exception.BusinessException;
import com.palpeer.notification.repository.DeviceTokenRepository;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Conditional;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.http.HttpStatus;
import org.springframework.util.StringUtils;

@Slf4j
@Configuration
@RequiredArgsConstructor
@EnableConfigurationProperties(FcmProperties.class)
@ConditionalOnProperty(prefix = "palpeer.fcm", name = "enabled", havingValue = "true")
@Conditional(FcmCredentialsPresentCondition.class)
public class FcmConfig {

    private final FcmProperties properties;

    @Bean
    FirebaseApp firebaseApp() throws IOException {
        if (!FirebaseApp.getApps().isEmpty()) {
            return FirebaseApp.getInstance();
        }
        GoogleCredentials credentials = loadCredentials();
        FirebaseOptions options = FirebaseOptions.builder().setCredentials(credentials).build();
        FirebaseApp app = FirebaseApp.initializeApp(options);
        log.info("Firebase Admin initialized for FCM push delivery");
        return app;
    }

    @Bean
    FirebaseMessaging firebaseMessaging(FirebaseApp firebaseApp) {
        return FirebaseMessaging.getInstance(firebaseApp);
    }

    @Bean
    FcmPushNotifier fcmPushNotifier(FirebaseMessaging firebaseMessaging, DeviceTokenRepository deviceTokenRepository) {
        return new FcmPushNotifier(firebaseMessaging, deviceTokenRepository);
    }

    @Bean
    @Primary
    PushNotifier routingPushNotifier(FcmPushNotifier fcmPushNotifier, ExpoPushNotifier expoPushNotifier) {
        return new RoutingPushNotifier(expoPushNotifier, fcmPushNotifier);
    }

    private GoogleCredentials loadCredentials() throws IOException {
        // Prefer a credentials file — inline JSON in .env is easy to corrupt (escaped newlines).
        if (StringUtils.hasText(properties.getCredentialsFile())) {
            Path path = Path.of(properties.getCredentialsFile().trim());
            if (!Files.isRegularFile(path)) {
                throw new BusinessException(
                        "FCM_CREDENTIALS_MISSING",
                        "FCM credentials file not found: " + path.toAbsolutePath(),
                        HttpStatus.INTERNAL_SERVER_ERROR);
            }
            try (InputStream in = Files.newInputStream(path)) {
                return GoogleCredentials.fromStream(in);
            }
        }
        if (StringUtils.hasText(properties.getCredentialsJson())) {
            byte[] bytes = properties.getCredentialsJson().getBytes(StandardCharsets.UTF_8);
            try (InputStream in = new ByteArrayInputStream(bytes)) {
                return GoogleCredentials.fromStream(in);
            }
        }
        throw new BusinessException(
                "FCM_CREDENTIALS_MISSING",
                "palpeer.fcm.enabled=true requires credentials-json or credentials-file",
                HttpStatus.INTERNAL_SERVER_ERROR);
    }
}
