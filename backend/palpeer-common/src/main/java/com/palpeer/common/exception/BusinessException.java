package com.palpeer.common.exception;

import org.springframework.http.HttpStatus;

public class BusinessException extends PalpeerException {

    public BusinessException(String code, String message) {
        super(code, message, HttpStatus.UNPROCESSABLE_ENTITY);
    }

    public BusinessException(String code, String message, HttpStatus status) {
        super(code, message, status);
    }

    public BusinessException(String code, String message, HttpStatus status, Throwable cause) {
        super(code, message, status, cause);
    }
}
