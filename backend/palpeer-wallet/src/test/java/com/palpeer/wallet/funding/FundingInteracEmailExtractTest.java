package com.palpeer.wallet.funding;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class FundingInteracEmailExtractTest {

    @Test
    void extractInteracEmail_keepsFullDomain() {
        String instructions =
                "Instant Interac Autodeposit. Send CAD 12.00 via Interac e-Transfer to pay@palpeer.com"
                        + " (Autodeposit — no security question). Include memo PPABCDEF1234 if your bank asks"
                        + " for a message. Your Interac email: sesanelect@yahoo.com";

        assertThat(FundingService.extractInteracEmail(instructions)).isEqualTo("sesanelect@yahoo.com");
    }

    @Test
    void extractInteracEmail_toleratesTrailingPeriod() {
        String instructions = "Your Interac email: sesanelect@yahoo.com.";

        assertThat(FundingService.extractInteracEmail(instructions)).isEqualTo("sesanelect@yahoo.com");
    }
}
