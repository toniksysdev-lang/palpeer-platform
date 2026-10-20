package com.palpeer.common.sms;

import org.springframework.boot.autoconfigure.condition.ConditionOutcome;
import org.springframework.boot.autoconfigure.condition.SpringBootCondition;
import org.springframework.context.annotation.ConditionContext;
import org.springframework.core.type.AnnotatedTypeMetadata;

/** Matches when BulkSMS is enabled and Token ID + Secret are present. */
public class BulkSmsConfiguredCondition extends SpringBootCondition {

    @Override
    public ConditionOutcome getMatchOutcome(ConditionContext context, AnnotatedTypeMetadata metadata) {
        var env = context.getEnvironment();
        boolean enabled = Boolean.parseBoolean(env.getProperty("palpeer.sms.bulksms.enabled", "false"));
        String tokenId = env.getProperty("palpeer.sms.bulksms.token-id", "");
        String secret = env.getProperty("palpeer.sms.bulksms.token-secret", "");
        if (enabled && !tokenId.isBlank() && !secret.isBlank()) {
            return ConditionOutcome.match("BulkSMS JSON API credentials present");
        }
        return ConditionOutcome.noMatch("BulkSMS disabled or token id/secret missing");
    }
}
