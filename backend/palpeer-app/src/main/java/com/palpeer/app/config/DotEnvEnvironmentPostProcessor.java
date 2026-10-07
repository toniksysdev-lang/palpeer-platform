package com.palpeer.app.config;

import java.io.BufferedReader;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.Map;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.Ordered;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;

/**
 * Loads a local {@code .env} file into the Spring Environment (does not override
 * existing system/env properties). Searches the process working directory and parents.
 */
public class DotEnvEnvironmentPostProcessor implements EnvironmentPostProcessor, Ordered {

    public static final String PROPERTY_SOURCE_NAME = "dotenv";

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        Path envFile = locateEnvFile();
        if (envFile == null) {
            return;
        }
        Map<String, Object> values = parse(envFile);
        if (values.isEmpty()) {
            return;
        }
        // Only add keys that are not already set in the environment
        Map<String, Object> missing = new HashMap<>();
        for (Map.Entry<String, Object> entry : values.entrySet()) {
            if (!environment.containsProperty(entry.getKey())
                    && System.getenv(entry.getKey()) == null
                    && System.getProperty(entry.getKey()) == null) {
                missing.put(entry.getKey(), entry.getValue());
            }
        }
        if (!missing.isEmpty()) {
            environment.getPropertySources().addLast(new MapPropertySource(PROPERTY_SOURCE_NAME, missing));
        }
    }

    private static Path locateEnvFile() {
        Path dir = Path.of(System.getProperty("user.dir")).toAbsolutePath().normalize();
        for (int i = 0; i < 6 && dir != null; i++) {
            Path candidate = dir.resolve(".env");
            if (Files.isRegularFile(candidate)) {
                return candidate;
            }
            dir = dir.getParent();
        }
        return null;
    }

    private static Map<String, Object> parse(Path envFile) {
        Map<String, Object> map = new HashMap<>();
        try (BufferedReader reader = Files.newBufferedReader(envFile, StandardCharsets.UTF_8)) {
            String line;
            while ((line = reader.readLine()) != null) {
                String trimmed = line.trim();
                if (trimmed.isEmpty() || trimmed.startsWith("#")) {
                    continue;
                }
                if (trimmed.startsWith("export ")) {
                    trimmed = trimmed.substring(7).trim();
                }
                int eq = trimmed.indexOf('=');
                if (eq <= 0) {
                    continue;
                }
                String key = trimmed.substring(0, eq).trim();
                String value = trimmed.substring(eq + 1).trim();
                if ((value.startsWith("\"") && value.endsWith("\""))
                        || (value.startsWith("'") && value.endsWith("'"))) {
                    value = value.substring(1, value.length() - 1);
                }
                map.put(key, value);
            }
        } catch (IOException ignored) {
            // Optional file — leave environment unchanged on read failure
        }
        return map;
    }

    @Override
    public int getOrder() {
        return Ordered.LOWEST_PRECEDENCE;
    }
}
