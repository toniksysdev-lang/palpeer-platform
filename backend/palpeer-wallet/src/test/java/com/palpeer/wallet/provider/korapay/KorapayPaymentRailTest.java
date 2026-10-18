package com.palpeer.wallet.provider.korapay;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.palpeer.common.exception.BusinessException;
import com.palpeer.wallet.provider.PaymentRailProvider;
import java.math.BigDecimal;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class KorapayPaymentRailTest {

    @Mock private KorapayClient korapayClient;

    private KorapayProperties properties;
    private KorapayPaymentRail rail;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @BeforeEach
    void setUp() {
        properties = new KorapayProperties();
        properties.setEnabled(true);
        properties.setSandbox(true);
        properties.setAutoSandboxSettle(true);
        properties.setOfflineSandboxSettle(true);
        rail = new KorapayPaymentRail(properties, korapayClient);
    }

    @Test
    void sanitizeReference_stripsHyphensAndMeetsMinLength() {
        String ref = KorapayPaymentRail.sanitizeReference("a1b2c3d4-e5f6-7890-abcd-ef1234567890");
        assertThat(ref).isEqualTo("a1b2c3d4e5f67890abcdef1234567890");
        assertThat(ref.length()).isGreaterThanOrEqualTo(8);
    }

    @Test
    void initiateWithdrawal_disbursesAndSettlesInSandbox() {
        when(korapayClient.isConfigured()).thenReturn(true);
        when(korapayClient.isSandboxMode()).thenReturn(true);
        ObjectNode data = objectMapper.createObjectNode();
        data.put("reference", "wd-ref-1");
        data.put("status", "processing");
        when(korapayClient.disburse(
                        anyString(),
                        eq(new BigDecimal("500.00")),
                        eq("058"),
                        eq("0123456789"),
                        anyString(),
                        anyString()))
                .thenReturn(data);

        PaymentRailProvider.WithdrawalInitiation result = rail.initiateWithdrawal(withdrawalRequest(
                new BigDecimal("500.00"), "058:0123456789"));

        assertThat(result.providerReference()).isEqualTo("wd-ref-1");
        assertThat(result.pendingExternalSettlement()).isFalse();
    }

    @Test
    void initiateWithdrawal_offlineSandboxSettle_whenDisburseFails() {
        when(korapayClient.isConfigured()).thenReturn(true);
        when(korapayClient.isSandboxMode()).thenReturn(true);
        when(korapayClient.disburse(anyString(), any(), anyString(), anyString(), anyString(), anyString()))
                .thenThrow(new BusinessException("KORAPAY_ERROR", "timeout", org.springframework.http.HttpStatus.BAD_GATEWAY));

        PaymentRailProvider.WithdrawalInitiation result = rail.initiateWithdrawal(withdrawalRequest(
                new BigDecimal("200.00"), "044:1234567890"));

        assertThat(result.providerReference()).startsWith("offline-");
        assertThat(result.pendingExternalSettlement()).isFalse();
    }

    @Test
    void initiateWithdrawal_rejectsLowAmount() {
        when(korapayClient.isConfigured()).thenReturn(true);

        assertThatThrownBy(() -> rail.initiateWithdrawal(withdrawalRequest(
                        new BigDecimal("50.00"), "044:1234567890")))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("NGN 100");
    }

    @Test
    void initiateWithdrawal_rejectsInvalidDestination() {
        when(korapayClient.isConfigured()).thenReturn(true);

        assertThatThrownBy(() -> rail.initiateWithdrawal(withdrawalRequest(
                        new BigDecimal("200.00"), "only-bank-code")))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("bankCode:accountNumber");
    }

    private static PaymentRailProvider.WithdrawalInitiationRequest withdrawalRequest(
            BigDecimal amount, String destination) {
        return new PaymentRailProvider.WithdrawalInitiationRequest(
                UUID.randomUUID(),
                UUID.randomUUID(),
                UUID.randomUUID(),
                "NGN",
                amount,
                destination,
                "user@example.com",
                "idem-1",
                "Ada Lovelace");
    }
}
