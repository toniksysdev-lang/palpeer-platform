package com.palpeer.notification.push;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Firebase Cloud Messaging (FCM HTTP v1 via Firebase Admin SDK).
 * Provide either a service-account JSON file path or the raw JSON string.
 */
@ConfigurationProperties(prefix = "palpeer.fcm")
public class FcmProperties {

    /** When false (default), {@link LoggingPushNotifier} is used. */
    private boolean enabled = false;

    /** Absolute or relative path to the Firebase service-account JSON file. */
    private String credentialsFile = "";

    /**
     * Inline service-account JSON (e.g. from env var on Render).
     * Takes precedence over {@link #credentialsFile} when non-blank.
     */
    private String credentialsJson = "";

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public String getCredentialsFile() {
        return credentialsFile;
    }

    public void setCredentialsFile(String credentialsFile) {
        this.credentialsFile = credentialsFile;
    }

    public String getCredentialsJson() {
        return credentialsJson;
    }

    public void setCredentialsJson(String credentialsJson) {
        this.credentialsJson = credentialsJson;
    }
}
