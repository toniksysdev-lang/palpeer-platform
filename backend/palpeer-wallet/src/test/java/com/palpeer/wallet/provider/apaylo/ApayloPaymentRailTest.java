package com.palpeer.wallet.provider.apaylo;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.palpeer.common.exception.BusinessException;
import com.palpeer.wallet.provider.PaymentRailProvider;
import java.math.BigDecimal;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ApayloPaymentRailTest {

    @Mock private ApayloClient apayloClient;

    private ApayloProperties properties;
    private ApayloPaymentRail rail;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @BeforeEach
    void setUp() {
        properties = new ApayloProperties();
        properties.setEnabled(true);
        properties.setSandbox(true);
        properties.setAutoSandboxSettle(true);
        properties.setOfflineSandboxSettle(true);
        properties.setSendInteracEtransferPath("/Merchant/SendInteracEtransfer");
        properties.setSendEftPath("/EFT/CreateEFTTransaction");
        rail = new ApayloPaymentRail(properties, apayloClient);
    }

    @Test
    void initiateWithdrawal_interacSettlesInSandbox() {
        when(apayloClient.isConfigured()).thenReturn(true);
        ObjectNode data = objectMapper.createObjectNode();
        data.put("TransactionNumber", "txn-cad-1");
        when(apayloClient.post(eq("/Merchant/SendInteracEtransfer"), anyMap())).thenReturn(data);

        PaymentRailProvider.WithdrawalInitiation result = rail.initiateWithdrawal(withdrawalRequest(
                new BigDecimal("25.00"), "user@example.com"));

        assertThat(result.providerReference()).isEqualTo("txn-cad-1");
        assertThat(result.pendingExternalSettlement()).isFalse();

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> bodyCaptor = ArgumentCaptor.forClass(Map.class);
        verify(apayloClient).post(eq("/Merchant/SendInteracEtransfer"), bodyCaptor.capture());
        assertThat(bodyCaptor.getValue()).containsEntry("CustomerEmail", "user@example.com");
        assertThat(bodyCaptor.getValue()).containsKey("SecurityQuestion");
        assertThat(bodyCaptor.getValue()).containsKey("CustomerName");
    }

    @Test
    void initiateWithdrawal_eftSettlesInSandbox() {
        when(apayloClient.isConfigured()).thenReturn(true);
        ObjectNode data = objectMapper.createObjectNode();
        data.put("ReferenceNumber", "eft-1");
        when(apayloClient.post(eq("/EFT/CreateEFTTransaction"), anyMap())).thenReturn(data);

        PaymentRailProvider.WithdrawalInitiation result = rail.initiateWithdrawal(withdrawalRequest(
                new BigDecimal("100.00"), "001:12345:9876543"));

        assertThat(result.providerReference()).isEqualTo("eft-1");
        assertThat(result.pendingExternalSettlement()).isFalse();
    }

    @Test
    void initiateWithdrawal_offlineSandboxSettle_whenApayloFails() {
        when(apayloClient.isConfigured()).thenReturn(true);
        when(apayloClient.post(any(), anyMap()))
                .thenThrow(new BusinessException(
                        "APAYLO_ERROR", "timeout", org.springframework.http.HttpStatus.BAD_GATEWAY));

        PaymentRailProvider.WithdrawalInitiation result = rail.initiateWithdrawal(withdrawalRequest(
                new BigDecimal("10.00"), "user@example.com"));

        assertThat(result.providerReference()).startsWith("offline-");
        assertThat(result.pendingExternalSettlement()).isFalse();
    }

    @Test
    void initiateWithdrawal_rejectsBlankDestination() {
        when(apayloClient.isConfigured()).thenReturn(true);

        assertThatThrownBy(() -> rail.initiateWithdrawal(withdrawalRequest(new BigDecimal("10.00"), " ")))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("Interac email/phone");
    }

    private static PaymentRailProvider.WithdrawalInitiationRequest withdrawalRequest(
            BigDecimal amount, String destination) {
        return new PaymentRailProvider.WithdrawalInitiationRequest(
                UUID.randomUUID(),
                UUID.randomUUID(),
                UUID.randomUUID(),
                "CAD",
                amount,
                destination,
                "owner@example.com",
                "idem-cad-1",
                "Ada Lovelace");
    }
}
