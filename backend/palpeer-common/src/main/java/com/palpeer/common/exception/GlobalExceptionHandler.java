package com.palpeer.common.exception;

import com.palpeer.common.api.ApiError;
import com.palpeer.common.api.ApiResponse;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(PalpeerException.class)
    public ResponseEntity<ApiResponse<Void>> handlePalpeerException(PalpeerException ex) {
        log.warn("Application error [{}]: {}", ex.getCode(), ex.getMessage());
        ApiError error = ApiError.builder()
                .code(ex.getCode())
                .detail(ex.getMessage())
                .build();
        return ResponseEntity.status(ex.getStatus())
                .body(ApiResponse.fail(ex.getMessage(), error));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Void>> handleValidation(MethodArgumentNotValidException ex) {
        List<ApiError.FieldViolation> violations = ex.getBindingResult().getFieldErrors().stream()
                .map(this::toViolation)
                .toList();

        ApiError error = ApiError.builder()
                .code("VALIDATION_FAILED")
                .detail("Request validation failed")
                .violations(violations)
                .build();

        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ApiResponse.fail("Validation failed", error));
    }

    @ExceptionHandler({MethodArgumentTypeMismatchException.class, MissingServletRequestParameterException.class})
    public ResponseEntity<ApiResponse<Void>> handleBadParameter(Exception ex) {
        String name = ex instanceof MethodArgumentTypeMismatchException mismatch
                ? mismatch.getName()
                : ((MissingServletRequestParameterException) ex).getParameterName();
        ApiError error = ApiError.builder()
                .code("INVALID_PARAMETER")
                .detail("Invalid or missing request parameter: " + name)
                .build();
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ApiResponse.fail("Invalid request parameter", error));
    }

    /** Malformed JSON, wrong types or unknown enum values; parser details are not echoed back. */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiResponse<Void>> handleUnreadableBody(HttpMessageNotReadableException ex) {
        log.warn("Unreadable request body: {}", ex.getMostSpecificCause().getClass().getSimpleName());
        ApiError error = ApiError.builder()
                .code("MALFORMED_REQUEST")
                .detail("The request body is malformed or contains an invalid value")
                .build();
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ApiResponse.fail("Malformed request body", error));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleUnexpected(Exception ex) {
        log.error("Unexpected error", ex);
        ApiError error = ApiError.builder()
                .code("INTERNAL_ERROR")
                .detail("An unexpected error occurred")
                .build();
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.fail("Internal server error", error));
    }

    private ApiError.FieldViolation toViolation(FieldError fieldError) {
        return ApiError.FieldViolation.builder()
                .field(fieldError.getField())
                .message(fieldError.getDefaultMessage())
                .build();
    }
}
