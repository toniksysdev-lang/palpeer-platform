package com.palpeer.common.domain;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

@Repository
public interface AuditEntityRepository
        extends JpaRepository<AuditEntity, UUID>, JpaSpecificationExecutor<AuditEntity> {
}
