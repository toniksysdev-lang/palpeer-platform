package com.palpeer.wallet.withdrawal;

import com.palpeer.wallet.withdrawal.dto.BankOptionResponse;
import java.util.List;

/**
 * Kuda UAT/sandbox bank directory used when {@code BANK_LIST} is unavailable.
 * <p>UAT bank codes differ from production NIP codes — never reuse
 * {@link NigerianBanksCatalog} against the Kuda sandbox OpenAPI.
 * Sample code {@code 999129} is documented by Kuda for UAT name enquiry / transfer tests.
 */
final class KudaSandboxBanksCatalog {

    private KudaSandboxBanksCatalog() {
    }

    static List<BankOptionResponse> all() {
        return List.of(
                bank("999129", "Kuda (UAT)", "kuda-uat"),
                bank("999001", "Test Bank One (UAT)", "test-bank-one-uat"),
                bank("999002", "Test Bank Two (UAT)", "test-bank-two-uat"));
    }

    private static BankOptionResponse bank(String code, String name, String slug) {
        return new BankOptionResponse(code, name, slug);
    }
}
