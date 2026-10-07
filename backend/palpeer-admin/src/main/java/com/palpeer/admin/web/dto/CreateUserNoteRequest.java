package com.palpeer.admin.web.dto;

import com.palpeer.admin.domain.UserNoteCategory;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreateUserNoteRequest(
        @NotNull UserNoteCategory category,
        @NotBlank @Size(max = 4000) String body) {
}
