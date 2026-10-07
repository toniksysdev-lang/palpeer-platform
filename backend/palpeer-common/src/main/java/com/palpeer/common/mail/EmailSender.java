package com.palpeer.common.mail;

/**
 * Platform email delivery abstraction — all outbound email goes through this.
 */
public interface EmailSender {

    /** Plain-text only (legacy callers). Prefer {@link #send(String, String, String, String)}. */
    default void send(String to, String subject, String textBody) {
        send(to, subject, textBody, null);
    }

    /**
     * Sends a multipart email. When {@code htmlBody} is non-blank, clients that support HTML
     * render that; others fall back to {@code textBody}.
     */
    void send(String to, String subject, String textBody, String htmlBody);
}
