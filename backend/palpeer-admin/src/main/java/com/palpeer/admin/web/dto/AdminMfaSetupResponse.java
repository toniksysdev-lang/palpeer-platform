package com.palpeer.admin.web.dto;

public record AdminMfaSetupResponse(String secret, String otpauthUrl) {}
