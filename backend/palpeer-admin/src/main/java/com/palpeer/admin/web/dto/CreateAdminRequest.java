package com.palpeer.admin.web.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * Create (or promote) an admin operator by email. When {@code password} is blank the server
 * generates a temporary password and emails it with the console sign-in link.
 */
public record CreateAdminRequest(
        @NotBlank @Email @Size(max = 320) String email,
        @Size(min = 8, max = 128) String password,
        @NotEmpty List<String> roleCodes,
        Boolean sendInviteEmail) {}
