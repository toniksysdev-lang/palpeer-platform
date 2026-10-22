package com.palpeer.notification.push;

import org.springframework.context.annotation.Condition;
import org.springframework.context.annotation.ConditionContext;
import org.springframework.core.env.Environment;
import org.springframework.core.type.AnnotatedTypeMetadata;
import org.springframework.util.StringUtils;

/** True when inline JSON or a credentials file path is configured for Firebase Admin. */
public class FcmCredentialsPresentCondition implements Condition {

    @Override
    public boolean matches(ConditionContext context, AnnotatedTypeMetadata metadata) {
        Environment env = context.getEnvironment();
        return StringUtils.hasText(env.getProperty("palpeer.fcm.credentials-json", ""))
                || StringUtils.hasText(env.getProperty("palpeer.fcm.credentials-file", ""));
    }

    public static boolean credentialsPresent(FcmProperties properties) {
        if (properties == null) {
            return false;
        }
        return StringUtils.hasText(properties.getCredentialsJson())
                || StringUtils.hasText(properties.getCredentialsFile());
    }
}
