package com.palpeer.admin.web.dto;

import java.util.List;

/**
 * Update an admin operator. Null fields are left unchanged. When {@code resetPassword} is true a
 * new temporary password is generated and emailed (when mail is configured).
 */
public record UpdateAdminRequest(List<String> roleCodes, Boolean enabled, Boolean resetPassword) {}
