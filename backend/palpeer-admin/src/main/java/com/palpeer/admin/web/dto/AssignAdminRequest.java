package com.palpeer.admin.web.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import java.util.UUID;

public record AssignAdminRequest(
        @NotNull UUID userId,
        @NotEmpty List<String> roleCodes
) {
}
