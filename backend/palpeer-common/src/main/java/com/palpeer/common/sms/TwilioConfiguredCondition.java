package com.palpeer.common.sms;

import org.springframework.boot.autoconfigure.condition.ConditionOutcome;
import org.springframework.boot.autoconfigure.condition.SpringBootCondition;
import org.springframework.context.annotation.ConditionContext;
import org.springframework.core.type.AnnotatedTypeMetadata;

/** Matches when Twilio is enabled and Account SID + auth + From/Messaging Service are present. */
public class TwilioConfiguredCondition extends SpringBootCondition {

    @Override
    public ConditionOutcome getMatchOutcome(ConditionContext context, AnnotatedTypeMetadata metadata) {
        var env = context.getEnvironment();
        boolean enabled = Boolean.parseBoolean(env.getProperty("palpeer.sms.twilio.enabled", "false"));
        String accountSid = env.getProperty("palpeer.sms.twilio.account-sid", "");
        String apiKeySid = env.getProperty("palpeer.sms.twilio.api-key-sid", "");
        String apiKeySecret = env.getProperty("palpeer.sms.twilio.api-key-secret", "");
        String authToken = env.getProperty("palpeer.sms.twilio.auth-token", "");
        String from = env.getProperty("palpeer.sms.twilio.from-number", "");
        String messagingService =
                env.getProperty("palpeer.sms.twilio.messaging-service-sid", "");

        boolean hasAccount = accountSid != null && !accountSid.isBlank();
        boolean hasApiKeyAuth = apiKeySid != null
                && !apiKeySid.isBlank()
                && apiKeySecret != null
                && !apiKeySecret.isBlank();
        boolean hasTokenAuth = authToken != null && !authToken.isBlank();
        boolean hasSender = (from != null && !from.isBlank())
                || (messagingService != null && !messagingService.isBlank());

        if (enabled && hasAccount && (hasApiKeyAuth || hasTokenAuth) && hasSender) {
            return ConditionOutcome.match("Twilio Messaging credentials present");
        }
        return ConditionOutcome.noMatch(
                "Twilio disabled or missing account SID / auth / from-or-messaging-service");
    }
}
