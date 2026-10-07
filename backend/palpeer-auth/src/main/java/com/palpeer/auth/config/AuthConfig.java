package com.palpeer.auth.config;

import com.palpeer.auth.security.JwtAuthenticationFilter;
import com.palpeer.auth.security.PalpeerUserDetailsService;
import com.palpeer.auth.service.JwtService;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

@Configuration
@EnableConfigurationProperties(AuthProperties.class)
public class AuthConfig {

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public JwtAuthenticationFilter jwtAuthenticationFilter(
            JwtService jwtService, PalpeerUserDetailsService userDetailsService) {
        return new JwtAuthenticationFilter(jwtService, userDetailsService);
    }
}
