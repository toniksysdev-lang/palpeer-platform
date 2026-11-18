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
        // Blank/missing status must not count as settled (fail closed).
        assertThat(ApayloPaymentRail.isCompletedStatus(null)).isFalse();
        assertThat(ApayloPaymentRail.isCompletedStatus("")).isFalse();
    }
}
