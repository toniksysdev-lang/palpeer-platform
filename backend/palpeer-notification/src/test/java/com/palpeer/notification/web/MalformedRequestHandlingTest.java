package com.palpeer.notification.web;

import static org.assertj.core.api.Assertions.assertThat;

import com.palpeer.common.api.ApiResponse;
import com.palpeer.common.exception.GlobalExceptionHandler;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.mock.http.MockHttpInputMessage;

class MalformedRequestHandlingTest {

    @Test
    void unknownEnumValueIsBadRequestWithoutParserDetails() {
        HttpMessageNotReadableException ex = new HttpMessageNotReadableException(
                "JSON parse error: Cannot deserialize value of type "
                        + "`com.palpeer.notification.domain.DeviceTokenPlatform` from String \"SYMBIAN\"",
                new IllegalArgumentException("SYMBIAN"),
                new MockHttpInputMessage(new byte[0]));

        ResponseEntity<ApiResponse<Void>> response = new GlobalExceptionHandler().handleUnreadableBody(ex);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().isSuccess()).isFalse();
        assertThat(response.getBody().getError().getCode()).isEqualTo("MALFORMED_REQUEST");
        assertThat(response.getBody().getError().getDetail())
                .doesNotContain("SYMBIAN")
                .doesNotContain("com.palpeer");
    }
}
