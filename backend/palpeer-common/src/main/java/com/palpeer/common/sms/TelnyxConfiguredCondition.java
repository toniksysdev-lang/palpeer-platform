package com.palpeer.common.sms;

import org.springframework.boot.autoconfigure.condition.ConditionOutcome;
import org.springframework.boot.autoconfigure.condition.SpringBootCondition;
import org.springframework.context.annotation.ConditionContext;
import org.springframework.core.type.AnnotatedTypeMetadata;

/** Matches when Telnyx is enabled and API key + messaging profile + from number are present. */
public class TelnyxConfiguredCondition extends SpringBootCondition {

    @Override
    public ConditionOutcome getMatchOutcome(ConditionContext context, AnnotatedTypeMetadata metadata) {
        var env = context.getEnvironment();
        boolean enabled = Boolean.parseBoolean(env.getProperty("palpeer.sms.telnyx.enabled", "false"));
        String apiKey = env.getProperty("palpeer.sms.telnyx.api-key", "");
        String profileId = env.getProperty("palpeer.sms.telnyx.messaging-profile-id", "");
        String from = env.getProperty("palpeer.sms.telnyx.from-number", "");

        boolean hasKey = apiKey != null && !apiKey.isBlank();
        boolean hasProfile = profileId != null && !profileId.isBlank();
        boolean hasFrom = from != null && !from.isBlank();

        if (enabled && hasKey && hasProfile && hasFrom) {
            return ConditionOutcome.match("Telnyx Messaging credentials present");
        }
        return ConditionOutcome.noMatch(
                "Telnyx disabled or missing api-key / messaging-profile-id / from-number");
    }
}
