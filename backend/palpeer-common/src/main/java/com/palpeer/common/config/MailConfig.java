package com.palpeer.common.config;

import com.palpeer.common.mail.PalpeerMailProperties;
import com.palpeer.common.mail.SendPulseMailProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * Enables {@link PalpeerMailProperties} / {@link SendPulseMailProperties}. Delivery uses SendPulse
 * REST when configured ({@code PALPEER_SENDPULSE_*}), otherwise Spring Mail SMTP
 * ({@code PALPEER_SMTP_*}).
 */
@Configuration
@EnableConfigurationProperties({PalpeerMailProperties.class, SendPulseMailProperties.class})
public class MailConfig {
}
