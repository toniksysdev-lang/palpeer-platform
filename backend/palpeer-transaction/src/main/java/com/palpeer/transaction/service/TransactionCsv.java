package com.palpeer.transaction.service;

import com.palpeer.common.csv.CsvWriter;
import com.palpeer.transaction.web.dto.TransactionItemResponse;
import java.util.List;

/**
 * CSV projection of {@link TransactionItemResponse} rows (admin exports).
 */
public final class TransactionCsv {

    private static final List<String> HEADER = List.of(
            "type", "id", "userId", "status", "walletId", "secondaryWalletId",
            "currencyCode", "secondaryCurrencyCode", "amount", "secondaryAmount",
            "appliedRate", "failureReason", "createdAt", "updatedAt");

    private TransactionCsv() {
    }

    public static CsvWriter write(List<TransactionItemResponse> items) {
        CsvWriter csv = new CsvWriter(HEADER);
        for (TransactionItemResponse t : items) {
            csv.row(
                    t.type(), t.id(), t.userId(), t.status(), t.walletId(), t.secondaryWalletId(),
                    t.currencyCode(), t.secondaryCurrencyCode(), t.amount(), t.secondaryAmount(),
                    t.appliedRate(), t.failureReason(), t.createdAt(), t.updatedAt());
        }
        return csv;
    }
}
