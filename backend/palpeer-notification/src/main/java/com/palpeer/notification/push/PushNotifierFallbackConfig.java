package com.palpeer.notification.push;

import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * When FCM Admin is not configured, still deliver Expo push tokens via the Expo Push API and log
 * native FCM/APNs tokens.
 *
 * <p>A {@code @Component} with {@code @ConditionalOnMissingBean(PushNotifier.class)} on the same
 * type is unreliable (condition can see its own definition and skip registration). Register via
 * {@code @Bean} instead.
 */
@Configuration
public class PushNotifierFallbackConfig {

    @Bean
    @ConditionalOnMissingBean(PushNotifier.class)
    PushNotifier expoAwarePushNotifier(ExpoPushNotifier expoPushNotifier) {
        return new RoutingPushNotifier(expoPushNotifier, new LoggingPushNotifier());
    }
}
