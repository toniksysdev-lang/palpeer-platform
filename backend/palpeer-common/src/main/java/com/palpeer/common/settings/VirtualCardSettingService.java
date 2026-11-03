package com.palpeer.common.settings;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Platform toggle for mobile virtual cards. When disabled, the app shows a coming-soon state
 * and card issue APIs reject new issuance.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class VirtualCardSettingService {

    public static final String SETTING_KEY = "features.virtual_cards.enabled";

    /** Keep cards available until an admin explicitly disables them. */
    public static final boolean DEFAULT_ENABLED = true;

    private final PlatformSettingRepository repository;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public boolean isEnabled() {
        return repository.findBySettingKey(SETTING_KEY).map(this::parseEnabled).orElse(DEFAULT_ENABLED);
    }

    @Transactional(readOnly = true)
    public VirtualCardsState getState() {
        return new VirtualCardsState(isEnabled());
    }

    @Transactional
    public VirtualCardsState setEnabled(boolean enabled) {
        PlatformSetting row =
                repository.findBySettingKey(SETTING_KEY).orElseGet(PlatformSetting::new);
        row.setSettingKey(SETTING_KEY);
        try {
            ObjectNode node = objectMapper.createObjectNode();
            node.put("enabled", enabled);
            row.setSettingValue(objectMapper.writeValueAsString(node));
        } catch (Exception ex) {
            throw new IllegalStateException("Could not serialize virtual card setting", ex);
        }
        repository.save(row);
        log.info("Virtual cards feature set to enabled={}", enabled);
        return new VirtualCardsState(enabled);
    }

    private boolean parseEnabled(PlatformSetting row) {
        String raw = row.getSettingValue();
        if (raw == null || raw.isBlank()) {
            return DEFAULT_ENABLED;
        }
        String trimmed = raw.trim();
        if ("true".equalsIgnoreCase(trimmed) || "false".equalsIgnoreCase(trimmed)) {
            return Boolean.parseBoolean(trimmed);
        }
        try {
            JsonNode node = objectMapper.readTree(trimmed);
            if (node.has("enabled")) {
                return node.get("enabled").asBoolean(DEFAULT_ENABLED);
            }
            if (node.isBoolean()) {
                return node.asBoolean(DEFAULT_ENABLED);
            }
        } catch (Exception ex) {
            log.warn("Invalid virtual card setting value; using default. key={}", SETTING_KEY);
        }
        return DEFAULT_ENABLED;
    }

    public record VirtualCardsState(boolean enabled) {}
}
