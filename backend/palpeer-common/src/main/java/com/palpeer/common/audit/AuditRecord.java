package com.palpeer.common.audit;

/**
 * Immutable audit write request.
 * CONTRACT_PENDING (P16-02): old/new value serialization format.
 */
public record AuditRecord(
        String action,
        String entity,
        String userRef,
        String oldValue,
        String newValue,
        String ipAddress,
        String device
) {

    public static Builder builder(String action) {
        return new Builder(action);
    }

    public static final class Builder {
        private final String action;
        private String entity;
        private String userRef;
        private String oldValue;
        private String newValue;
        private String ipAddress;
        private String device;

        private Builder(String action) {
            this.action = action;
        }

        public Builder entity(String entity) {
            this.entity = entity;
            return this;
        }

        public Builder userRef(String userRef) {
            this.userRef = userRef;
            return this;
        }

        public Builder userRef(java.util.UUID userId) {
            this.userRef = userId == null ? null : userId.toString();
            return this;
        }

        public Builder oldValue(String oldValue) {
            this.oldValue = oldValue;
            return this;
        }

        public Builder newValue(String newValue) {
            this.newValue = newValue;
            return this;
        }

        public Builder ipAddress(String ipAddress) {
            this.ipAddress = ipAddress;
            return this;
        }

        public Builder device(String device) {
            this.device = device;
            return this;
        }

        public AuditRecord build() {
            return new AuditRecord(action, entity, userRef, oldValue, newValue, ipAddress, device);
        }
    }
}
