package com.palpeer.common.exception;

import org.springframework.http.HttpStatus;

/**
 * Base domain/application exception carrying a stable error code and HTTP status.
 */
public class PalpeerException extends RuntimeException {

    private final String code;
    private final HttpStatus status;

    public PalpeerException(String code, String message, HttpStatus status) {
        super(message);
        this.code = code;
        this.status = status;
    }

    public PalpeerException(String code, String message, HttpStatus status, Throwable cause) {
        super(message, cause);
        this.code = code;
        this.status = status;
    }

    public String getCode() {
        return code;
    }

    public HttpStatus getStatus() {
        return status;
    }
}
