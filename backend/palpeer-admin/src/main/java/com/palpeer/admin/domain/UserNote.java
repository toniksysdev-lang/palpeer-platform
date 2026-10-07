package com.palpeer.admin.domain;

import com.palpeer.common.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

/** Append-only internal note on an app user, written by an operator (incident record). */
@Getter
@Setter
@Entity
@Table(name = "admin_user_notes")
public class UserNote extends BaseEntity {

    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @Column(name = "author_user_id", nullable = false, updatable = false)
    private UUID authorUserId;

    @Column(name = "author_email", nullable = false, updatable = false, length = 320)
    private String authorEmail;

    @Enumerated(EnumType.STRING)
    @Column(name = "category", nullable = false, updatable = false, length = 40)
    private UserNoteCategory category;

    @Column(name = "body", nullable = false, updatable = false, length = 4000)
    private String body;
}
