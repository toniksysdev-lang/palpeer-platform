package com.palpeer.app.config;

import com.palpeer.kyc.config.ComplyCubeProperties;
import com.palpeer.wallet.provider.apaylo.ApayloProperties;
import com.palpeer.wallet.provider.kuda.KudaProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

@Configuration
@EnableConfigurationProperties({
        ComplyCubeProperties.class,
        ApayloProperties.class,
        KudaProperties.class
})
public class IntegrationConfig {

    @Bean
    RestClient.Builder restClientBuilder() {
        return RestClient.builder();
    }
}
