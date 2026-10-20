package com.palpeer.common.settings;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.palpeer.common.exception.BusinessException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class RegistrationCountryService {

    public static final String SETTING_KEY = "registration.allowed_countries";

    /** Default corridor list used when the setting row is missing. */
    public static final List<String> DEFAULT_COUNTRIES =
            List.of("CA", "US", "GB", "NG", "GH", "KE");

    private static final Set<String> ISO_COUNTRIES =
            Set.copyOf(Arrays.asList(Locale.getISOCountries()));

    private final PlatformSettingRepository repository;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public RegistrationCountriesState getState() {
        return repository
                .findBySettingKey(SETTING_KEY)
                .map(this::parseState)
                .orElseGet(() -> new RegistrationCountriesState(
                        new ArrayList<>(DEFAULT_COUNTRIES), new ArrayList<>(DEFAULT_COUNTRIES)));
    }

    @Transactional(readOnly = true)
    public List<String> listAllowedIso2() {
        return getState().enabledIso2();
    }

    @Transactional(readOnly = true)
    public boolean isAllowed(String iso2) {
        if (iso2 == null || iso2.isBlank()) {
            return false;
        }
        String code = iso2.trim().toUpperCase(Locale.ROOT);
        return listAllowedIso2().stream().anyMatch(code::equals);
    }

    @Transactional
    public RegistrationCountriesState replaceState(
            List<String> configuredIso2, List<String> enabledIso2) {
        List<String> configured = normalizeIso2List(configuredIso2, true);
        if (configured.isEmpty()) {
            configured = new ArrayList<>(DEFAULT_COUNTRIES);
        }
        Set<String> configuredSet = new LinkedHashSet<>(configured);
        List<String> enabled = normalizeIso2List(enabledIso2, true);
        List<String> enabledFiltered = enabled.stream().filter(configuredSet::contains).toList();
        if (enabledFiltered.isEmpty()) {
            throw new BusinessException(
                    "REGISTRATION_COUNTRIES_EMPTY",
                    "At least one registration country must remain enabled",
                    HttpStatus.BAD_REQUEST);
        }

        RegistrationCountriesState state =
                new RegistrationCountriesState(List.copyOf(configured), List.copyOf(enabledFiltered));
        PlatformSetting row =
                repository.findBySettingKey(SETTING_KEY).orElseGet(PlatformSetting::new);
        row.setSettingKey(SETTING_KEY);
        try {
            row.setSettingValue(objectMapper.writeValueAsString(state));
        } catch (Exception ex) {
            throw new IllegalStateException("Could not serialize registration countries", ex);
        }
        repository.save(row);
        return state;
    }

    /** Backward-compatible save of enabled codes only (configured = union of defaults + enabled). */
    @Transactional
    public List<String> replaceAllowedIso2(List<String> iso2Codes) {
        List<String> enabled = normalizeIso2List(iso2Codes, true);
        if (enabled.isEmpty()) {
            throw new BusinessException(
                    "REGISTRATION_COUNTRIES_EMPTY",
                    "At least one registration country must remain enabled",
                    HttpStatus.BAD_REQUEST);
        }
        Set<String> configured = new LinkedHashSet<>(DEFAULT_COUNTRIES);
        configured.addAll(enabled);
        return replaceState(new ArrayList<>(configured), enabled).enabledIso2();
    }

    private List<String> normalizeIso2List(List<String> iso2Codes, boolean requireKnownIso) {
        Set<String> normalized = new LinkedHashSet<>();
        if (iso2Codes == null) {
            return new ArrayList<>();
        }
        for (String raw : iso2Codes) {
            if (raw == null || raw.isBlank()) {
                continue;
            }
            String code = raw.trim().toUpperCase(Locale.ROOT);
            if (code.length() != 2) {
                throw new BusinessException(
                        "REGISTRATION_COUNTRY_INVALID",
                        "Invalid country code: " + raw,
                        HttpStatus.BAD_REQUEST);
            }
            if (requireKnownIso && !ISO_COUNTRIES.contains(code)) {
                throw new BusinessException(
                        "REGISTRATION_COUNTRY_UNSUPPORTED",
                        "Unknown ISO country code: " + code,
                        HttpStatus.BAD_REQUEST);
            }
            normalized.add(code);
        }
        return new ArrayList<>(normalized);
    }

    private RegistrationCountriesState parseState(PlatformSetting row) {
        try {
            JsonNode root = objectMapper.readTree(row.getSettingValue());
            if (root != null && root.isArray()) {
                List<String> enabled =
                        objectMapper.convertValue(root, new TypeReference<List<String>>() {}).stream()
                                .map(c -> c.trim().toUpperCase(Locale.ROOT))
                                .filter(c -> c.length() == 2)
                                .toList();
                if (enabled.isEmpty()) {
                    return new RegistrationCountriesState(
                            new ArrayList<>(DEFAULT_COUNTRIES), new ArrayList<>(DEFAULT_COUNTRIES));
                }
                Set<String> configured = new LinkedHashSet<>(DEFAULT_COUNTRIES);
                configured.addAll(enabled);
                return new RegistrationCountriesState(
                        new ArrayList<>(configured), new ArrayList<>(enabled));
            }
            if (root != null && root.isObject()) {
                List<String> configured = readIsoList(root.get("configuredIso2"));
                if (configured.isEmpty()) {
                    configured = readIsoList(root.get("configured"));
                }
                List<String> enabled = readIsoList(root.get("enabledIso2"));
                if (enabled.isEmpty()) {
                    enabled = readIsoList(root.get("enabled"));
                }
                if (configured.isEmpty() && enabled.isEmpty()) {
                    return new RegistrationCountriesState(
                            new ArrayList<>(DEFAULT_COUNTRIES), new ArrayList<>(DEFAULT_COUNTRIES));
                }
                if (configured.isEmpty()) {
                    Set<String> union = new LinkedHashSet<>(DEFAULT_COUNTRIES);
                    union.addAll(enabled);
                    configured = new ArrayList<>(union);
                }
                if (enabled.isEmpty()) {
                    enabled = new ArrayList<>(configured);
                }
                Set<String> configuredSet = new LinkedHashSet<>(configured);
                enabled = enabled.stream().filter(configuredSet::contains).toList();
                if (enabled.isEmpty()) {
                    enabled = new ArrayList<>(configured);
                }
                return new RegistrationCountriesState(
                        new ArrayList<>(configured), new ArrayList<>(enabled));
            }
        } catch (Exception ex) {
            log.warn("Invalid registration.allowed_countries JSON; using defaults: {}", ex.getMessage());
        }
        return new RegistrationCountriesState(
                new ArrayList<>(DEFAULT_COUNTRIES), new ArrayList<>(DEFAULT_COUNTRIES));
    }

    private List<String> readIsoList(JsonNode node) {
        if (node == null || !node.isArray()) {
            return new ArrayList<>();
        }
        List<String> out = new ArrayList<>();
        for (JsonNode item : node) {
            if (item == null || !item.isTextual()) {
                continue;
            }
            String code = item.asText().trim().toUpperCase(Locale.ROOT);
            if (code.length() == 2) {
                out.add(code);
            }
        }
        return out;
    }

    public record RegistrationCountriesState(List<String> configuredIso2, List<String> enabledIso2) {}
}
