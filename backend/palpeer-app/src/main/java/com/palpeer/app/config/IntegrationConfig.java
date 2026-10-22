package com.palpeer.app.config;

import com.palpeer.kyc.config.ComplyCubeProperties;
import com.palpeer.notification.push.FcmProperties;
import com.palpeer.wallet.provider.apaylo.ApayloProperties;
import com.palpeer.wallet.provider.korapay.KorapayProperties;
import com.palpeer.wallet.provider.kuda.KudaProperties;
import java.net.http.HttpClient;
import java.time.Duration;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

@Configuration
@EnableConfigurationProperties({
        ComplyCubeProperties.class,
        ApayloProperties.class,
        KorapayProperties.class,
        KudaProperties.class,
        FcmProperties.class
})
public class IntegrationConfig {

    /** Shared builder with bounded timeouts (Expo push previously used the infinite defaults). */
    @Bean
    RestClient.Builder restClientBuilder() {
        HttpClient httpClient =
                HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(httpClient);
        factory.setReadTimeout(Duration.ofSeconds(20));
        return RestClient.builder().requestFactory(factory);
    }
}
