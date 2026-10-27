package com.palpeer.admin.web.dto;

/**
 * Result of creating/promoting an admin. {@code temporaryPassword} is returned once so the
 * operator can copy it if email delivery fails; it is never stored in plaintext.
 */
public record CreateAdminResponse(
        AdminUserResponse admin, String temporaryPassword, boolean inviteEmailSent) {}
