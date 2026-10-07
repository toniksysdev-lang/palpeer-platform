package com.palpeer.app.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.boot.SpringApplication;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.StandardEnvironment;

class DotEnvEnvironmentPostProcessorTest {

    private String previousUserDir;

    @AfterEach
    void restoreCwd() {
        if (previousUserDir != null) {
            System.setProperty("user.dir", previousUserDir);
        }
    }

    @Test
    void loadsDotEnvWithoutOverridingExistingProperties(@TempDir Path tempDir) throws Exception {
        previousUserDir = System.getProperty("user.dir");
        System.setProperty("user.dir", tempDir.toAbsolutePath().toString());

        Files.writeString(tempDir.resolve(".env"), """
                DB_HOST=from-dotenv
                DB_PORT=6543
                EXISTING_KEY=should-not-win
                """);

        ConfigurableEnvironment environment = new StandardEnvironment();
        environment.getSystemProperties().put("EXISTING_KEY", "already-set");

        new DotEnvEnvironmentPostProcessor()
                .postProcessEnvironment(environment, new SpringApplication());

        assertThat(environment.getProperty("DB_HOST")).isEqualTo("from-dotenv");
        assertThat(environment.getProperty("DB_PORT")).isEqualTo("6543");
        assertThat(environment.getProperty("EXISTING_KEY")).isEqualTo("already-set");
        assertThat(environment.getPropertySources().contains("dotenv")).isTrue();
    }
}
