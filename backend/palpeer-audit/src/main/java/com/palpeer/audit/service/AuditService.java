package com.palpeer.audit.service;

import com.palpeer.common.audit.AuditRecord;
import com.palpeer.common.audit.AuditRecorder;
import com.palpeer.common.audit.AuditRequestContext;
import com.palpeer.common.domain.AuditEntity;
import com.palpeer.common.domain.AuditEntityRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

/**
 * Persists audit trail rows for financial, admin, and security changes.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AuditService implements AuditRecorder {

    private final AuditEntityRepository auditEntityRepository;

    @Override
    @Transactional
    public void record(AuditRecord record) {
        if (record == null || !StringUtils.hasText(record.action())) {
            log.warn("Skipping audit record with missing action");
            return;
        }
        AuditEntity entity = new AuditEntity();
        entity.setAction(trim(record.action(), 100));
        entity.setEntity(trim(record.entity(), 100));
        entity.setUserRef(trim(record.userRef(), 100));
        entity.setOldValue(record.oldValue());
        entity.setNewValue(record.newValue());
        entity.setIpAddress(firstNonBlank(record.ipAddress(), AuditRequestContext.ipAddress(), 45));
        entity.setDevice(firstNonBlank(record.device(), AuditRequestContext.device(), 255));
        auditEntityRepository.save(entity);
    }

    private static String firstNonBlank(String preferred, String fallback, int max) {
        return trim(StringUtils.hasText(preferred) ? preferred : fallback, max);
    }

    private static String trim(String value, int max) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        String t = value.trim();
        return t.length() <= max ? t : t.substring(0, max);
    }
}
