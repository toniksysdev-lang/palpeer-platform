package com.palpeer.common.api;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ApiError {

    private String code;
    private String detail;
    private List<FieldViolation> violations;

    @Getter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class FieldViolation {
        private String field;
        private String message;
    }
}
