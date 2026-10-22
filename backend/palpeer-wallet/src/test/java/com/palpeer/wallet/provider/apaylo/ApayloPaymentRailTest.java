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
        properties.setAutoSandboxSettle(false);
        properties.setOfflineSandboxSettle(true);
        properties.setAccountId("Palpeer Global Holding Inc");
        properties.setAplReference("APL1234");
        properties.setCreateSearchableEtransferPath("/Merchant/RequestInteracEtransferLink");
        properties.setSendInteracEtransferPath("/Merchant/SendInteracEtransfer");
        properties.setSendEftPath("/EFT/CreateEFTTransaction");
        rail = new ApayloPaymentRail(properties, apayloClient);
    }

    @Test
    void initiateFunding_usesLinkApiAndStaysPendingForCustomerInterac() {
        when(apayloClient.isConfigured()).thenReturn(true);
        // Even if auto-settle is on, funding must wait for the Instant Interac payment step.
        properties.setAutoSandboxSettle(true);
        ObjectNode data = objectMapper.createObjectNode();
        data.put("ReferenceNumber", "REF-INSTANT-1");
        when(apayloClient.post(eq("/Merchant/RequestInteracEtransferLink"), anyMap())).thenReturn(data);

        PaymentRailProvider.FundingInitiation result = rail.initiateFunding(
                new PaymentRailProvider.FundingInitiationRequest(
                        UUID.randomUUID(),
                        UUID.randomUUID(),
                        UUID.randomUUID(),
                        "CAD",
                        new BigDecimal("100.00"),
                        "account@example.com",
                        "+15551212",
                        "idem-fund-1",
                        "Ada",
                        "Lovelace",
                        "sesanelect@yahoo.com",
                        "Oluwasesan",
                        "Afolabi"));

        assertThat(result.providerReference()).isEqualTo("REF-INSTANT-1");
        assertThat(result.pendingExternalSettlement()).isTrue();
        assertThat(result.instructions())
                .contains("Palpeer Global Holding Inc")
                .contains("sesanelect@yahoo.com")
                .contains("Instant deposit via Interac")
                .doesNotContain("Sandbox funding completed")
                .doesNotContain("accept the Interac request");

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> bodyCaptor = ArgumentCaptor.forClass(Map.class);
        verify(apayloClient).post(eq("/Merchant/RequestInteracEtransferLink"), bodyCaptor.capture());
        assertThat(bodyCaptor.getValue()).containsEntry("CustomerEmail", "sesanelect@yahoo.com");
        assertThat(bodyCaptor.getValue()).containsEntry("CustomerName", "Oluwasesan Afolabi");
        assertThat(bodyCaptor.getValue()).containsEntry("UniqueId", "idem-fund-1");
        assertThat(bodyCaptor.getValue().get("Description").toString()).contains("APL1234");
    }

    @Test
    void initiateWithdrawal_interacStaysPendingUntilWebhook() {
        properties.setAutoSandboxSettle(true);
        when(apayloClient.isConfigured()).thenReturn(true);
        ObjectNode data = objectMapper.createObjectNode();
        data.put("TransactionNumber", "txn-cad-1");
        when(apayloClient.post(eq("/Merchant/SendInteracEtransfer"), anyMap())).thenReturn(data);

        PaymentRailProvider.WithdrawalInitiation result = rail.initiateWithdrawal(withdrawalRequest(
                new BigDecimal("25.00"), "user@example.com"));

        assertThat(result.providerReference()).isEqualTo("txn-cad-1");
        assertThat(result.pendingExternalSettlement()).isTrue();

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> bodyCaptor = ArgumentCaptor.forClass(Map.class);
        verify(apayloClient).post(eq("/Merchant/SendInteracEtransfer"), bodyCaptor.capture());
        assertThat(bodyCaptor.getValue()).containsEntry("CustomerEmail", "user@example.com");
        assertThat(bodyCaptor.getValue()).containsKey("SecurityQuestion");
        assertThat(bodyCaptor.getValue()).containsKey("CustomerName");
    }

    @Test
    void initiateWithdrawal_eftStaysPendingUntilWebhook() {
        properties.setAutoSandboxSettle(true);
        when(apayloClient.isConfigured()).thenReturn(true);
        ObjectNode data = objectMapper.createObjectNode();
        data.put("ReferenceNumber", "eft-1");
        when(apayloClient.post(eq("/EFT/CreateEFTTransaction"), anyMap())).thenReturn(data);

        PaymentRailProvider.WithdrawalInitiation result = rail.initiateWithdrawal(withdrawalRequest(
                new BigDecimal("100.00"), "001:12345:9876543"));

        assertThat(result.providerReference()).isEqualTo("eft-1");
        assertThat(result.pendingExternalSettlement()).isTrue();
    }

    @Test
    void initiateWithdrawal_propagatesFailure_whenApayloFails() {
        properties.setOfflineSandboxSettle(true);
        when(apayloClient.isConfigured()).thenReturn(true);
        when(apayloClient.post(any(), anyMap()))
                .thenThrow(new BusinessException(
                        "APAYLO_ERROR", "timeout", org.springframework.http.HttpStatus.BAD_GATEWAY));

        assertThatThrownBy(() -> rail.initiateWithdrawal(withdrawalRequest(
                        new BigDecimal("10.00"), "user@example.com")))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("timeout");
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
