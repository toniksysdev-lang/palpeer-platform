package com.palpeer.admin.repository;

import com.palpeer.admin.domain.UserNote;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface UserNoteRepository extends JpaRepository<UserNote, UUID> {

    Page<UserNote> findByUserIdOrderByCreatedAtDesc(UUID userId, Pageable pageable);
}
