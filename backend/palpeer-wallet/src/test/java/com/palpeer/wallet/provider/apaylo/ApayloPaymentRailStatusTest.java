package com.palpeer.wallet.provider.apaylo;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class ApayloPaymentRailStatusTest {

    @Test
    void completedStatusesIncludeSettledAndCompleted() {
        assertThat(ApayloPaymentRail.isCompletedStatus("Completed")).isTrue();
        assertThat(ApayloPaymentRail.isCompletedStatus("settled")).isTrue();
        assertThat(ApayloPaymentRail.isCompletedStatus("Sent")).isFalse();
        assertThat(ApayloPaymentRail.isCompletedStatus("Pending")).isFalse();
        // Incoming search endpoint only returns completed rows — blank treated as completed.
        assertThat(ApayloPaymentRail.isCompletedStatus(null)).isTrue();
    }
}
