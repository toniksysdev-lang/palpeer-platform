package com.palpeer.admin.web.dto;

import com.palpeer.user.domain.UserStatus;

public record UpdateUserAdminRequest(
        UserStatus status,
        Boolean enabled
) {
}
