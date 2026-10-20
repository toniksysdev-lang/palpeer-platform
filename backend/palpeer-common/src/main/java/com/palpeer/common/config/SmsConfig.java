package com.palpeer.common.config;

import com.palpeer.common.sms.BulkSmsProperties;
import com.palpeer.common.sms.LoggingSmsSender;
import com.palpeer.common.sms.SmsSender;
import com.palpeer.common.sms.TelnyxProperties;
import com.palpeer.common.sms.TwilioProperties;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties({BulkSmsProperties.class, TwilioProperties.class, TelnyxProperties.class})
public class SmsConfig {

    /** Fallback when no live provider (Telnyx / Twilio / BulkSMS) registers an {@link SmsSender}. */
    @Bean
    @ConditionalOnMissingBean(SmsSender.class)
    public SmsSender loggingSmsSender() {
        return new LoggingSmsSender();
    }
}
