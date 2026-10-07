package com.palpeer.audit.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.palpeer.common.audit.AuditRecord;
import com.palpeer.common.audit.AuditRequestContext;
import com.palpeer.common.domain.AuditEntity;
import com.palpeer.common.domain.AuditEntityRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class AuditServiceTest {

    @Mock private AuditEntityRepository auditEntityRepository;
    @InjectMocks private AuditService auditService;

    @AfterEach
    void clearContext() {
        AuditRequestContext.clear();
    }

    @Test
    void record_persistsActionAndEnrichesFromRequestContext() {
        AuditRequestContext.set("203.0.113.10", "JUnit-Agent");
        when(auditEntityRepository.save(any(AuditEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        auditService.record(AuditRecord.builder("LEDGER_POST")
                .entity("LedgerEntry:1")
                .userRef("user-1")
                .oldValue("available=0")
                .newValue("available=10")
                .build());

        ArgumentCaptor<AuditEntity> captor = ArgumentCaptor.forClass(AuditEntity.class);
        verify(auditEntityRepository).save(captor.capture());
        AuditEntity saved = captor.getValue();
        assertThat(saved.getAction()).isEqualTo("LEDGER_POST");
        assertThat(saved.getEntity()).isEqualTo("LedgerEntry:1");
        assertThat(saved.getUserRef()).isEqualTo("user-1");
        assertThat(saved.getIpAddress()).isEqualTo("203.0.113.10");
        assertThat(saved.getDevice()).isEqualTo("JUnit-Agent");
        assertThat(saved.getOldValue()).isEqualTo("available=0");
        assertThat(saved.getNewValue()).isEqualTo("available=10");
    }

    @Test
    void record_skipsBlankAction() {
        auditService.record(AuditRecord.builder("  ").build());
        verify(auditEntityRepository, org.mockito.Mockito.never()).save(any());
    }
}
