package com.palpeer.app;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.data.redis.RedisRepositoriesAutoConfiguration;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

/**
 * Redis is used for distributed auth rate limits. Repository scanning stays off (no Redis entities).
 * Health stays green when Redis is down ({@code management.health.redis.enabled=false}).
 */
@SpringBootApplication(
        scanBasePackages = "com.palpeer",
        exclude = {RedisRepositoriesAutoConfiguration.class}
)
@EntityScan(basePackages = "com.palpeer")
@EnableJpaRepositories(basePackages = "com.palpeer")
public class PalpeerApplication {

    public static void main(String[] args) {
        SpringApplication.run(PalpeerApplication.class, args);
    }
}
