package com.palpeer.transaction.web.dto;

import java.util.List;

public record TransactionPageResponse(
        List<TransactionItemResponse> items,
        int page,
        int size,
        long totalElements,
        int totalPages
) {
}
