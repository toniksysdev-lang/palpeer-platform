package com.palpeer.common.audit;

/**
 * Domain audit trail writer. Implementations persist {@link com.palpeer.common.domain.AuditEntity}.
 * CONTRACT_PENDING (P16-01): action catalog / naming convention.
 */
public interface AuditRecorder {

    void record(AuditRecord record);
}
