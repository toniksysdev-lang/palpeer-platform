package com.palpeer.admin.repository;

import com.palpeer.admin.domain.Permission;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PermissionRepository extends JpaRepository<Permission, UUID> {

    Optional<Permission> findByCode(String code);
}
