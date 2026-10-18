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
        assertThat(environment.getPropertySources().stream().findFirst().orElseThrow().getName())
                .isEqualTo("dotenv");
    }

    @Test
    void loadsEnvDespiteMalformedUtf8Byte(@TempDir Path tempDir) throws Exception {
        previousUserDir = System.getProperty("user.dir");
        System.setProperty("user.dir", tempDir.toAbsolutePath().toString());

        // 0x97 is invalid UTF-8 (common Windows-1252 em-dash) — must not abort the whole file.
        String prefix = "# note\nPALPEER_SMTP_USERNAME=user@example.com\nPALPEER_SMTP_PASSWORD=secret\n# bad: ";
        String suffix = "\nOTP_LOG_CODE=true\n";
        byte[] prefixBytes = prefix.getBytes(java.nio.charset.StandardCharsets.UTF_8);
        byte[] suffixBytes = suffix.getBytes(java.nio.charset.StandardCharsets.UTF_8);
        byte[] bytes = new byte[prefixBytes.length + 1 + suffixBytes.length];
        System.arraycopy(prefixBytes, 0, bytes, 0, prefixBytes.length);
        bytes[prefixBytes.length] = (byte) 0x97;
        System.arraycopy(suffixBytes, 0, bytes, prefixBytes.length + 1, suffixBytes.length);
        Files.write(tempDir.resolve(".env"), bytes);

        ConfigurableEnvironment environment = new StandardEnvironment();
        new DotEnvEnvironmentPostProcessor()
                .postProcessEnvironment(environment, new SpringApplication());

        assertThat(environment.getProperty("PALPEER_SMTP_USERNAME")).isEqualTo("user@example.com");
        assertThat(environment.getProperty("OTP_LOG_CODE")).isEqualTo("true");
    }

    @Test
    void boot3ImportsFileListsProcessorClassName() throws Exception {
        var resource =
                DotEnvEnvironmentPostProcessor.class
                        .getClassLoader()
                        .getResource(
                                "META-INF/spring/org.springframework.boot.env.EnvironmentPostProcessor.imports");
        assertThat(resource).isNotNull();
        String body = Files.readString(Path.of(resource.toURI()));
        assertThat(body.lines().map(String::trim).filter(l -> !l.isEmpty() && !l.startsWith("#")))
                .containsExactly(DotEnvEnvironmentPostProcessor.class.getName());
    }
}
