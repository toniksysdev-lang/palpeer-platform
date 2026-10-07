package com.palpeer.admin.web.dto;

import jakarta.validation.constraints.Size;
import java.util.List;

public record UpdateRoleRequest(
        @Size(max = 120) String name,
        @Size(max = 255) String description,
        List<String> permissionCodes
) {
}
