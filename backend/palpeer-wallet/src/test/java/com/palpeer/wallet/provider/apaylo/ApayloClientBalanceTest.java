package com.palpeer.wallet.provider.apaylo;

import static org.assertj.core.api.Assertions.assertThat;

import com.palpeer.common.exception.BusinessException;
import org.junit.jupiter.api.Test;

class ApayloClientBalanceTest {

    @Test
    void isInsufficientFundsMessage_detectsApayloWalletError() {
        assertThat(ApayloClient.isInsufficientFundsMessage("Insufficient funds in your wallet")).isTrue();
        assertThat(ApayloClient.isInsufficientFundsMessage("Please enter details properly")).isFalse();
    }

    @Test
    void toApayloBusinessException_mapsInsufficientFundsToInternalPaymentError() {
        BusinessException ex =
                ApayloClient.toApayloBusinessException("Insufficient funds in your wallet");
        assertThat(ex.getCode()).isEqualTo("INTERNAL_PAYMENT_ERROR");
        assertThat(ex.getStatus()).isEqualTo(org.springframework.http.HttpStatus.UNPROCESSABLE_ENTITY);
    }

    @Test
    void toApayloBusinessException_keepsOtherErrorsAsApayloError() {
        BusinessException ex = ApayloClient.toApayloBusinessException("Please enter security answer");
        assertThat(ex.getCode()).isEqualTo("APAYLO_ERROR");
    }
}
