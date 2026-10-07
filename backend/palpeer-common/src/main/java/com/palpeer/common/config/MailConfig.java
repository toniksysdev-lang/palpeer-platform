package com.palpeer.common.config;

import com.palpeer.common.mail.PalpeerMailProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * Enables {@link PalpeerMailProperties} ({@code palpeer.mail.*} / {@code PALPEER_MAIL_*}).
 * SMTP transport uses Spring Boot's {@code spring.mail.*} auto-configuration
 * ({@code PALPEER_SMTP_*} in {@code .env}).
 */
@Configuration
@EnableConfigurationProperties(PalpeerMailProperties.class)
public class MailConfig {
}
