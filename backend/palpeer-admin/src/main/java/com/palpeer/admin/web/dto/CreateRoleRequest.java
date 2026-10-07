package com.palpeer.admin.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;

public record CreateRoleRequest(
        @NotBlank
        @Size(max = 80)
        @Pattern(
                regexp = "^[A-Z][A-Z0-9_]*$",
                message = "Role code must be UPPER_SNAKE_CASE")
        String code,
        @NotBlank @Size(max = 120) String name,
        @Size(max = 255) String description,
        @NotEmpty List<String> permissionCodes
) {
}
