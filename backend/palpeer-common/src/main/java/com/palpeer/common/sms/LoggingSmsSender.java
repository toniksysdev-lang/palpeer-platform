package com.palpeer.common.sms;

import lombok.extern.slf4j.Slf4j;

/**
 * Dev / fallback SMS sender when no live provider bean is registered. Created from
 * {@link com.palpeer.common.config.SmsConfig} via {@code @ConditionalOnMissingBean}.
 */
@Slf4j
public class LoggingSmsSender implements SmsSender {

    @Override
    public void send(String to, String body) {
        log.warn(
                "SMS placeholder (no live SMS provider configured) [to={}, bodyChars={}]",
                to,
                body == null ? 0 : body.length());
    }
}
