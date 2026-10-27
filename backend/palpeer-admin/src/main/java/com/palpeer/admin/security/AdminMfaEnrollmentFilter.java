package com.palpeer.admin.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.palpeer.admin.service.AdminMfaService;
import com.palpeer.auth.security.UserPrincipal;
import com.palpeer.common.api.ApiError;
import com.palpeer.common.api.ApiResponse;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.lang.NonNull;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * When {@code palpeer.admin.mfa-required=true}, blocks admin APIs until TOTP is enrolled.
 * Allows {@code /admin/me} and {@code /admin/mfa/**} so the console can finish setup.
 * Registered only on the Spring Security filter chain.
 */
@RequiredArgsConstructor
public class AdminMfaEnrollmentFilter extends OncePerRequestFilter {

    private final AdminMfaService adminMfaService;
    private final ObjectMapper objectMapper;

    @Override
    protected boolean shouldNotFilter(@NonNull HttpServletRequest request) {
        String path = normalize(request.getRequestURI());
        if (!path.startsWith("/api/v1/admin")) {
            return true;
        }
        return path.equals("/api/v1/admin/me") || path.startsWith("/api/v1/admin/mfa");
    }

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain) throws ServletException, IOException {

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UserPrincipal principal) {
            if (adminMfaService.isEnrollmentRequired(principal.getId())) {
                response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                ApiError error = ApiError.builder()
                        .code("MFA_ENROLLMENT_REQUIRED")
                        .detail("Enable authenticator MFA before using the admin console.")
                        .build();
                objectMapper.writeValue(
                        response.getOutputStream(),
                        ApiResponse.fail("Enable authenticator MFA before using the admin console.", error));
                return;
            }
        }
        filterChain.doFilter(request, response);
    }

    private static String normalize(String uri) {
        if (uri == null || uri.isBlank()) {
            return "";
        }
        String path = uri;
        int q = path.indexOf('?');
        if (q >= 0) {
            path = path.substring(0, q);
        }
        if (path.length() > 1 && path.endsWith("/")) {
            path = path.substring(0, path.length() - 1);
        }
        return path.toLowerCase(Locale.ROOT);
    }
}
