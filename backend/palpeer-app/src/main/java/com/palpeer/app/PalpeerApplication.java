package com.palpeer.app;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.data.redis.RedisAutoConfiguration;
import org.springframework.boot.autoconfigure.data.redis.RedisRepositoriesAutoConfiguration;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

/**
 * Redis auto-config is excluded until domain code uses Redis.
 * Re-enable when caching/sessions need it; docker-compose already ships Redis.
 */
@SpringBootApplication(
        scanBasePackages = "com.palpeer",
        exclude = {RedisAutoConfiguration.class, RedisRepositoriesAutoConfiguration.class}
)
@EntityScan(basePackages = "com.palpeer")
@EnableJpaRepositories(basePackages = "com.palpeer")
public class PalpeerApplication {

    public static void main(String[] args) {
        SpringApplication.run(PalpeerApplication.class, args);
    }
}
