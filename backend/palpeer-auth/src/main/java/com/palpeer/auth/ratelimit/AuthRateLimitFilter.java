package com.palpeer.auth.ratelimit;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.palpeer.auth.config.AuthProperties;
import com.palpeer.common.api.ApiError;
import com.palpeer.common.api.ApiResponse;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.Duration;
import java.util.Locale;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.lang.NonNull;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * IP-based rate limits on public auth endpoints (login, OTP, password-reset, register).
 * Registered only on the Spring Security filter chain (not as a servlet Filter bean).
 */
@RequiredArgsConstructor
public class AuthRateLimitFilter extends OncePerRequestFilter {

    private static final Duration WINDOW = Duration.ofMinutes(1);
    private static final Set<String> LOGIN_PATHS =
            Set.of("/api/v1/auth/login", "/api/v1/auth/google", "/api/v1/auth/mfa/verify");
    private static final Set<String> OTP_PATHS = Set.of(
            "/api/v1/auth/otp/resend",
            "/api/v1/auth/otp/verify",
            "/api/v1/auth/otp/phone/request",
            "/api/v1/auth/otp/phone/verify",
            "/api/v1/auth/signup/resend-email-otp",
            "/api/v1/auth/signup/change-email");
    private static final Set<String> PASSWORD_RESET_PATHS = Set.of(
            "/api/v1/auth/password-reset/request", "/api/v1/auth/password-reset/confirm");
    private static final Set<String> REGISTER_PATHS = Set.of("/api/v1/auth/register");

    private final AuthProperties authProperties;
    private final AuthRateLimiter rateLimiter;
    private final ObjectMapper objectMapper;

    @Override
    protected boolean shouldNotFilter(@NonNull HttpServletRequest request) {
        if (!authProperties.getRateLimit().isEnabled()) {
            return true;
        }
        if (!HttpMethod.POST.matches(request.getMethod())) {
            return true;
        }
        String path = normalize(request.getRequestURI());
        return limitFor(path) <= 0;
    }

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain) throws ServletException, IOException {

        String path = normalize(request.getRequestURI());
        int limit = limitFor(path);
        String client = clientKey(request);
        String bucket = bucketFor(path) + ":" + client;

        if (!rateLimiter.tryAcquire(bucket, limit, WINDOW)) {
            writeTooManyRequests(response);
            return;
        }
        filterChain.doFilter(request, response);
    }

    private int limitFor(String path) {
        AuthProperties.RateLimit cfg = authProperties.getRateLimit();
        if (LOGIN_PATHS.contains(path)) {
            return cfg.getLoginPerMinute();
        }
        if (OTP_PATHS.contains(path)) {
            return cfg.getOtpPerMinute();
        }
        if (PASSWORD_RESET_PATHS.contains(path)) {
            return cfg.getPasswordResetPerMinute();
        }
        if (REGISTER_PATHS.contains(path)) {
            return cfg.getRegisterPerMinute();
        }
        return 0;
    }

    private static String bucketFor(String path) {
        if (LOGIN_PATHS.contains(path)) {
            return "login";
        }
        if (OTP_PATHS.contains(path)) {
            return "otp";
        }
        if (PASSWORD_RESET_PATHS.contains(path)) {
            return "password-reset";
        }
        if (REGISTER_PATHS.contains(path)) {
            return "register";
        }
        return "other";
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

    private static String clientKey(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            int comma = forwarded.indexOf(',');
            return (comma > 0 ? forwarded.substring(0, comma) : forwarded).trim();
        }
        String realIp = request.getHeader("X-Real-IP");
        if (realIp != null && !realIp.isBlank()) {
            return realIp.trim();
        }
        return request.getRemoteAddr() == null ? "unknown" : request.getRemoteAddr();
    }

    private void writeTooManyRequests(HttpServletResponse response) throws IOException {
        response.setStatus(429);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        ApiError error = ApiError.builder()
                .code("RATE_LIMITED")
                .detail("Too many requests. Please try again later.")
                .build();
        objectMapper.writeValue(
                response.getOutputStream(),
                ApiResponse.fail("Too many requests. Please try again later.", error));
    }
}
