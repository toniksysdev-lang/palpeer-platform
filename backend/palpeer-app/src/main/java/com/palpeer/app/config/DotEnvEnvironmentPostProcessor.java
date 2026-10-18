package com.palpeer.app.config;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.CharsetDecoder;
import java.nio.charset.CodingErrorAction;
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
        // Only add keys that are not already set (blank env/sys props count as unset).
        Map<String, Object> missing = new HashMap<>();
        for (Map.Entry<String, Object> entry : values.entrySet()) {
            if (!isAlreadySet(environment, entry.getKey())) {
                missing.put(entry.getKey(), entry.getValue());
            }
        }
        if (!missing.isEmpty()) {
            // Must run before ConfigData resolves ${PALPEER_SMTP_*:} placeholders (see getOrder).
            environment.getPropertySources().addFirst(new MapPropertySource(PROPERTY_SOURCE_NAME, missing));
        }
    }

    private static boolean isAlreadySet(ConfigurableEnvironment environment, String key) {
        String env = System.getenv(key);
        if (env != null && !env.isBlank()) {
            return true;
        }
        String sys = System.getProperty(key);
        if (sys != null && !sys.isBlank()) {
            return true;
        }
        String fromEnv = environment.getProperty(key);
        return fromEnv != null && !fromEnv.isBlank();
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
        // REPLACE malformed bytes so a single Windows-1252 character can't wipe the whole file.
        CharsetDecoder decoder =
                StandardCharsets.UTF_8
                        .newDecoder()
                        .onMalformedInput(CodingErrorAction.REPLACE)
                        .onUnmappableCharacter(CodingErrorAction.REPLACE);
        try (BufferedReader reader =
                new BufferedReader(new InputStreamReader(Files.newInputStream(envFile), decoder))) {
            String line;
            boolean first = true;
            while ((line = reader.readLine()) != null) {
                if (first) {
                    line = stripBom(line);
                    first = false;
                }
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
        } catch (IOException ex) {
            System.err.println("DotEnv: failed to read " + envFile + ": " + ex);
        }
        return map;
    }

    private static String stripBom(String line) {
        if (line != null && !line.isEmpty() && line.charAt(0) == '\uFEFF') {
            return line.substring(1);
        }
        return line;
    }

    /**
     * Before {@code ConfigDataEnvironmentPostProcessor} so placeholders like
     * {@code ${PALPEER_SMTP_USERNAME:}} resolve against {@code .env} instead of the empty default.
     */
    @Override
    public int getOrder() {
        return Ordered.HIGHEST_PRECEDENCE;
    }
}
