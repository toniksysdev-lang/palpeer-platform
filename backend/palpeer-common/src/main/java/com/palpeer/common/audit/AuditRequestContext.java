package com.palpeer.common.audit;

/**
 * Request-scoped IP / User-Agent for audit rows.
 * CONTRACT_PENDING (P16-03): trusted proxy / device fingerprint rules.
 */
public final class AuditRequestContext {

    private static final ThreadLocal<Holder> HOLDER = new ThreadLocal<>();

    private AuditRequestContext() {
    }

    public static void set(String ipAddress, String device) {
        HOLDER.set(new Holder(trim(ipAddress), trim(device)));
    }

    public static void clear() {
        HOLDER.remove();
    }

    public static String ipAddress() {
        Holder h = HOLDER.get();
        return h == null ? null : h.ipAddress();
    }

    public static String device() {
        Holder h = HOLDER.get();
        return h == null ? null : h.device();
    }

    private static String trim(String value) {
        if (value == null) {
            return null;
        }
        String t = value.trim();
        return t.isEmpty() ? null : t;
    }

    private record Holder(String ipAddress, String device) {
    }
}
