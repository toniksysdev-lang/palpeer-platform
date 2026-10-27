package com.palpeer.admin.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record CreatePermissionRequest(
        @NotBlank
        @Size(max = 80)
        @Pattern(
                regexp = "^[a-z][a-z0-9_]*(:[a-z][a-z0-9_]*)+$",
                message = "Permission code must look like resource:action (lowercase, nested segments allowed)")
        String code,
        @Size(max = 255) String description
) {
}
