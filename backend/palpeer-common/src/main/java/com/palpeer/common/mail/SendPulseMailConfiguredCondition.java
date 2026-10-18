package com.palpeer.common.mail;

import org.springframework.context.annotation.Condition;
import org.springframework.context.annotation.ConditionContext;
import org.springframework.core.env.Environment;
import org.springframework.core.type.AnnotatedTypeMetadata;
import org.springframework.util.StringUtils;

/**
 * Activates {@link SendPulseEmailSender} when provider is {@code sendpulse}, or {@code auto} with
 * API credentials present (or {@code palpeer.mail.sendpulse.enabled=true}).
 */
public class SendPulseMailConfiguredCondition implements Condition {

    @Override
    public boolean matches(ConditionContext context, AnnotatedTypeMetadata metadata) {
        Environment env = context.getEnvironment();
        String provider = env.getProperty("palpeer.mail.provider", "auto").trim();
        if ("smtp".equalsIgnoreCase(provider)) {
            return false;
        }
        if ("sendpulse".equalsIgnoreCase(provider)) {
            return true;
        }
        // auto
        boolean enabledFlag =
                Boolean.parseBoolean(env.getProperty("palpeer.mail.sendpulse.enabled", "false"));
        String clientId = env.getProperty("palpeer.mail.sendpulse.client-id", "");
        String clientSecret = env.getProperty("palpeer.mail.sendpulse.client-secret", "");
        return enabledFlag
                || (StringUtils.hasText(clientId) && StringUtils.hasText(clientSecret));
    }
}
