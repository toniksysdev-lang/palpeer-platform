package com.palpeer.auth.web.dto;

/**
 * Optional device metadata supplied by the mobile client on login.
 * When {@code deviceIdentifier} is present, only that install may stay signed in.
 */
public record DeviceLoginInfo(String deviceIdentifier, String deviceName, String platform) {

    public static DeviceLoginInfo of(String deviceIdentifier, String deviceName, String platform) {
        String id = blankToNull(deviceIdentifier);
        if (id == null) {
            return null;
        }
        return new DeviceLoginInfo(
                id.length() > 128 ? id.substring(0, 128) : id,
                truncate(blankToNull(deviceName), 120),
                truncate(blankToNull(platform), 40));
    }

    private static String blankToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static String truncate(String value, int max) {
        if (value == null) {
            return null;
        }
        return value.length() > max ? value.substring(0, max) : value;
    }
}
