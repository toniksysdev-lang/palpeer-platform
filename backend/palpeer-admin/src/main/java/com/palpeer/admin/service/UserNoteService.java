package com.palpeer.admin.service;

import com.palpeer.admin.domain.UserNote;
import com.palpeer.admin.repository.UserNoteRepository;
import com.palpeer.admin.web.dto.CreateUserNoteRequest;
import com.palpeer.admin.web.dto.UserNoteResponse;
import com.palpeer.common.audit.AuditRecord;
import com.palpeer.common.audit.AuditRecorder;
import com.palpeer.common.exception.ResourceNotFoundException;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class UserNoteService {

    private final UserNoteRepository userNoteRepository;
    private final AdminUserService adminUserService;
    private final AuditRecorder auditRecorder;

    @Transactional(readOnly = true)
    public Page<UserNoteResponse> list(UUID userId, Pageable pageable) {
        requireAppUser(userId);
        return userNoteRepository.findByUserIdOrderByCreatedAtDesc(userId, pageable).map(UserNoteService::toResponse);
    }

    @Transactional
    public UserNoteResponse create(UUID userId, UUID authorUserId, String authorEmail, CreateUserNoteRequest request) {
        requireAppUser(userId);
        UserNote note = new UserNote();
        note.setUserId(userId);
        note.setAuthorUserId(authorUserId);
        note.setAuthorEmail(authorEmail);
        note.setCategory(request.category());
        note.setBody(request.body().trim());
        UserNote saved = userNoteRepository.save(note);
        auditRecorder.record(AuditRecord.builder("ADMIN_USER_NOTE_CREATE")
                .entity("UserNote:" + saved.getId())
                .userRef(userId)
                .newValue("category=" + saved.getCategory() + ";author=" + authorUserId)
                .build());
        return toResponse(saved);
    }

    private void requireAppUser(UUID userId) {
        if (!adminUserService.isAppUser(userId)) {
            throw new ResourceNotFoundException("User not found");
        }
    }

    private static UserNoteResponse toResponse(UserNote note) {
        return new UserNoteResponse(
                note.getId(),
                note.getUserId(),
                note.getCategory(),
                note.getBody(),
                note.getAuthorUserId(),
                note.getAuthorEmail(),
                note.getCreatedAt());
    }
}
