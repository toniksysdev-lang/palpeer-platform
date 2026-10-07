package com.palpeer.security.repository;

import com.palpeer.security.domain.SecurityQuestion;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface SecurityQuestionRepository extends JpaRepository<SecurityQuestion, UUID> {

    List<SecurityQuestion> findByUserId(UUID userId);

    void deleteByUserId(UUID userId);

    long countByUserId(UUID userId);
}
