package com.palpeer.wallet.provider.kuda;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.palpeer.common.exception.BusinessException;
import com.palpeer.wallet.domain.PaymentVirtualAccount;
import com.palpeer.wallet.provider.PaymentRailProvider;
import com.palpeer.wallet.repository.PaymentVirtualAccountRepository;
import java.math.BigDecimal;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class KudaPaymentRailTest {

    @Mock private KudaClient kudaClient;
    @Mock private PaymentVirtualAccountRepository virtualAccountRepository;

    private KudaProperties properties;
    private KudaPaymentRail rail;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @BeforeEach
    void setUp() {
        properties = new KudaProperties();
        properties.setEnabled(true);
        properties.setSandbox(true);
        properties.setAutoSandboxSettle(false);
        properties.setOfflineSandboxSettle(true);
        properties.setDemoFundEnabled(false);
        properties.setSenderName("PALPEER");
        rail = new KudaPaymentRail(properties, kudaClient, virtualAccountRepository);
    }

    @Test
    void initiateFunding_sandboxDefaultShowsTransferInstructionsPending() {
        when(kudaClient.isConfigured()).thenReturn(true);
        when(kudaClient.isSandboxMode()).thenReturn(true);

        UUID walletId = UUID.randomUUID();
        PaymentVirtualAccount account = existingVa(walletId);
        when(virtualAccountRepository.findByWalletIdAndProviderName(walletId, KudaPaymentRail.NAME))
                .thenReturn(Optional.of(account));

        PaymentRailProvider.FundingInitiation result = rail.initiateFunding(fundingRequest(walletId, "250.00"));

        assertThat(result.pendingExternalSettlement()).isTrue();
        assertThat(result.instructions())
                .contains("Transfer NGN")
                .contains("250.00")
                .contains(account.getAccountNumber())
                .contains(account.getAccountName())
                .doesNotContain("FUND_VIRTUAL_ACCOUNT");
        verify(kudaClient, never()).invoke(eq("FUND_VIRTUAL_ACCOUNT"), anyMap());
        verify(kudaClient, never()).invoke(eq("ADMIN_CREATE_VIRTUAL_ACCOUNT"), any());
    }

    @Test
    void initiateFunding_sandboxDemoFundStaysPendingUntilWebhook() {
        properties.setDemoFundEnabled(true);
        properties.setAutoSandboxSettle(true);
        when(kudaClient.isConfigured()).thenReturn(true);
        when(kudaClient.isSandboxMode()).thenReturn(true);
        when(kudaClient.toKobo(new BigDecimal("250.00"))).thenReturn(25_000L);

        UUID walletId = UUID.randomUUID();
        PaymentVirtualAccount account = existingVa(walletId);
        when(virtualAccountRepository.findByWalletIdAndProviderName(walletId, KudaPaymentRail.NAME))
                .thenReturn(Optional.of(account));

        ObjectNode fundResponse = objectMapper.createObjectNode();
        fundResponse.put("transactionReference", "kuda-demo-ref-1");
        when(kudaClient.invoke(eq("FUND_VIRTUAL_ACCOUNT"), anyMap())).thenReturn(fundResponse);

        PaymentRailProvider.FundingInitiation result = rail.initiateFunding(fundingRequest(walletId, "250.00"));

        assertThat(result.providerReference()).isEqualTo("kuda-demo-ref-1");
        assertThat(result.pendingExternalSettlement()).isTrue();
        assertThat(result.instructions())
                .contains("FUND_VIRTUAL_ACCOUNT")
                .contains("Waiting for confirmation")
                .contains(account.getAccountNumber());

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> bodyCaptor = ArgumentCaptor.forClass(Map.class);
        verify(kudaClient).invoke(eq("FUND_VIRTUAL_ACCOUNT"), bodyCaptor.capture());
        assertThat(bodyCaptor.getValue()).containsEntry("trackingReference", account.getTrackingReference());
        assertThat(bodyCaptor.getValue()).containsEntry("amount", 25_000L);
    }

    @Test
    void initiateFunding_liveShowsTransferInstructionsWithoutDemoFund() {
        when(kudaClient.isConfigured()).thenReturn(true);
        when(kudaClient.isSandboxMode()).thenReturn(false);

        UUID walletId = UUID.randomUUID();
        PaymentVirtualAccount account = existingVa(walletId);
        when(virtualAccountRepository.findByWalletIdAndProviderName(walletId, KudaPaymentRail.NAME))
                .thenReturn(Optional.of(account));

        PaymentRailProvider.FundingInitiation result = rail.initiateFunding(fundingRequest(walletId, "100.00"));

        assertThat(result.pendingExternalSettlement()).isTrue();
        assertThat(result.instructions())
                .contains("Transfer NGN")
                .contains(account.getAccountNumber())
                .doesNotContain("FUND_VIRTUAL_ACCOUNT");
        verify(kudaClient, never()).invoke(eq("FUND_VIRTUAL_ACCOUNT"), anyMap());
    }

    @Test
    void initiateWithdrawal_staysPendingUntilWebhook() {
        properties.setAutoSandboxSettle(true);
        when(kudaClient.isConfigured()).thenReturn(true);
        when(kudaClient.toKobo(new BigDecimal("500.00"))).thenReturn(50_000L);

        ObjectNode enquiry = objectMapper.createObjectNode();
        enquiry.put("SessionID", "sess-1");
        enquiry.put("BeneficiaryName", "ADA LOVELACE");
        when(kudaClient.invoke(eq("NAME_ENQUIRY"), anyMap())).thenReturn(enquiry);

        ObjectNode transfer = objectMapper.createObjectNode();
        transfer.put("transactionReference", "kuda-wd-1");
        when(kudaClient.invoke(eq("SINGLE_FUND_TRANSFER"), anyMap())).thenReturn(transfer);

        PaymentRailProvider.WithdrawalInitiation result =
                rail.initiateWithdrawal(withdrawalRequest(new BigDecimal("500.00"), "044:0123456789"));

        assertThat(result.providerReference()).isEqualTo("kuda-wd-1");
        assertThat(result.pendingExternalSettlement()).isTrue();

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> bodyCaptor = ArgumentCaptor.forClass(Map.class);
        verify(kudaClient).invoke(eq("SINGLE_FUND_TRANSFER"), bodyCaptor.capture());
        assertThat(bodyCaptor.getValue()).containsEntry("beneficiarybankCode", "044");
        assertThat(bodyCaptor.getValue()).containsEntry("beneficiaryAccount", "0123456789");
        assertThat(bodyCaptor.getValue()).containsEntry("amount", 50_000L);
        assertThat(bodyCaptor.getValue()).containsEntry("senderName", "PALPEER");
    }

    @Test
    void initiateWithdrawal_propagatesFailure_whenKudaFails() {
        properties.setOfflineSandboxSettle(true);
        when(kudaClient.isConfigured()).thenReturn(true);
        when(kudaClient.invoke(eq("NAME_ENQUIRY"), anyMap()))
                .thenThrow(new BusinessException(
                        "KUDA_ERROR", "timeout", org.springframework.http.HttpStatus.BAD_GATEWAY));

        assertThatThrownBy(() -> rail.initiateWithdrawal(withdrawalRequest(
                        new BigDecimal("100.00"), "044:0123456789")))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("timeout");
    }

    private static PaymentVirtualAccount existingVa(UUID walletId) {
        PaymentVirtualAccount account = new PaymentVirtualAccount();
        account.setUserId(UUID.randomUUID());
        account.setWalletId(walletId);
        account.setCurrencyCode("NGN");
        account.setProviderName(KudaPaymentRail.NAME);
        account.setTrackingReference("pptrackingref001");
        account.setAccountNumber("3001234567");
        account.setAccountName("PALPEER USER");
        account.setBankName("Kuda");
        account.setActive(true);
        return account;
    }

    private static PaymentRailProvider.FundingInitiationRequest fundingRequest(UUID walletId, String amount) {
        return new PaymentRailProvider.FundingInitiationRequest(
                UUID.randomUUID(),
                walletId,
                UUID.randomUUID(),
                "NGN",
                new BigDecimal(amount),
                "user@example.com",
                "08012345678",
                "idem-ngn-1",
                "Ada",
                "Lovelace");
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
                "idem-wd-1",
                "Ada Lovelace");
    }
}
