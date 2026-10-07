package com.palpeer.security.domain;

import com.palpeer.common.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

/**
 * User security question + hashed answer.
 * CONTRACT_PENDING (P3-02): question catalog and required count.
 */
@Getter
@Setter
@Entity
@Table(
        name = "security_questions",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_security_questions_user_question",
                columnNames = {"user_id", "question_key"}
        )
)
public class SecurityQuestion extends BaseEntity {

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    /**
     * Stable key or free-text question identifier until catalog is confirmed.
     */
    @Column(name = "question_key", nullable = false, length = 120)
    private String questionKey;

    @Column(name = "question_text", nullable = false, length = 500)
    private String questionText;

    @Column(name = "answer_hash", nullable = false, length = 255)
    private String answerHash;
}
