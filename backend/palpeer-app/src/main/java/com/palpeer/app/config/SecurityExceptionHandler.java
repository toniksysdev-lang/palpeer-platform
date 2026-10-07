package com.palpeer.app.config;

import com.palpeer.common.api.ApiError;
import com.palpeer.common.api.ApiResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authorization.AuthorizationDeniedException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * Maps Spring Security authorization failures to 403 (not 500 via the generic handler).
 */
@Slf4j
@Order(Ordered.HIGHEST_PRECEDENCE)
@RestControllerAdvice
public class SecurityExceptionHandler {

    @ExceptionHandler({AccessDeniedException.class, AuthorizationDeniedException.class})
    public ResponseEntity<ApiResponse<Void>> handleAccessDenied(Exception ex) {
        log.warn("Access denied: {}", ex.getMessage());
        ApiError error = ApiError.builder()
                .code("ACCESS_DENIED")
                .detail("Access is denied")
                .build();
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(ApiResponse.fail("Access denied", error));
    }
}
