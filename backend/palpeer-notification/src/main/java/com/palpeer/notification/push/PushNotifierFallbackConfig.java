package com.palpeer.notification.push;

import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Provides {@link LoggingPushNotifier} when FCM routing is not configured.
 *
 * <p>A {@code @Component} with {@code @ConditionalOnMissingBean(PushNotifier.class)} on the same
 * type is unreliable (condition can see its own definition and skip registration). Register via
 * {@code @Bean} instead.
 */
@Configuration
public class PushNotifierFallbackConfig {

    @Bean
    @ConditionalOnMissingBean(PushNotifier.class)
    PushNotifier loggingPushNotifier() {
        return new LoggingPushNotifier();
    }
}
