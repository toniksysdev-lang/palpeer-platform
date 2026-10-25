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
        properties.setAutoSandboxSettle(false);
        when(kudaClient.isConfigured()).thenReturn(true);
        when(kudaClient.isSandboxMode()).thenReturn(true);
        when(kudaClient.toKobo(new BigDecimal("500.00"))).thenReturn(50_000L);

        ObjectNode enquiry = objectMapper.createObjectNode();
        enquiry.put("SessionID", "sess-1");
        enquiry.put("BeneficiaryName", "ADA LOVELACE");
        when(kudaClient.invoke(eq("NAME_ENQUIRY"), anyMap())).thenReturn(enquiry);

        ObjectNode transfer = objectMapper.createObjectNode();
        transfer.put("transactionReference", "kuda-wd-1");
        when(kudaClient.invoke(eq("SINGLE_FUND_TRANSFER"), anyMap())).thenReturn(transfer);

        PaymentRailProvider.WithdrawalInitiation result =
                rail.initiateWithdrawal(withdrawalRequest(new BigDecimal("500.00"), "999129:0123456789"));

        assertThat(result.providerReference()).isEqualTo("kuda-wd-1");
        assertThat(result.pendingExternalSettlement()).isTrue();

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> bodyCaptor = ArgumentCaptor.forClass(Map.class);
        verify(kudaClient).invoke(eq("SINGLE_FUND_TRANSFER"), bodyCaptor.capture());
        assertThat(bodyCaptor.getValue()).containsEntry("beneficiaryBankCode", "999129");
        assertThat(bodyCaptor.getValue()).containsEntry("beneficiaryAccount", "0123456789");
        assertThat(bodyCaptor.getValue()).containsEntry("amount", "50000");
        assertThat(bodyCaptor.getValue()).containsEntry("senderName", "PALPEER");
        assertThat(bodyCaptor.getValue().get("trackingReference").toString()).doesNotContain("-");
    }

    @Test
    void initiateWithdrawal_autoSandboxSettle_settlesImmediately() {
        properties.setAutoSandboxSettle(true);
        when(kudaClient.isConfigured()).thenReturn(true);
        when(kudaClient.isSandboxMode()).thenReturn(true);
        when(kudaClient.toKobo(new BigDecimal("500.00"))).thenReturn(50_000L);

        ObjectNode enquiry = objectMapper.createObjectNode();
        enquiry.put("SessionID", "sess-1");
        enquiry.put("BeneficiaryName", "ADA LOVELACE");
        when(kudaClient.invoke(eq("NAME_ENQUIRY"), anyMap())).thenReturn(enquiry);

        ObjectNode transfer = objectMapper.createObjectNode();
        transfer.put("transactionReference", "kuda-wd-auto");
        when(kudaClient.invoke(eq("SINGLE_FUND_TRANSFER"), anyMap())).thenReturn(transfer);

        PaymentRailProvider.WithdrawalInitiation result =
                rail.initiateWithdrawal(withdrawalRequest(new BigDecimal("500.00"), "999129:0123456789"));

        assertThat(result.providerReference()).isEqualTo("kuda-wd-auto");
        assertThat(result.pendingExternalSettlement()).isFalse();
    }

    @Test
    void initiateWithdrawal_offlineSandboxSettle_whenKudaFails() {
        properties.setOfflineSandboxSettle(true);
        when(kudaClient.isConfigured()).thenReturn(true);
        when(kudaClient.isSandboxMode()).thenReturn(true);
        when(kudaClient.invoke(eq("NAME_ENQUIRY"), anyMap()))
                .thenThrow(new BusinessException(
                        "KUDA_NAME_ENQUIRY_FAILED",
                        "Name Enquiry request not satisfied.",
                        org.springframework.http.HttpStatus.BAD_GATEWAY));

        PaymentRailProvider.WithdrawalInitiation result = rail.initiateWithdrawal(withdrawalRequest(
                new BigDecimal("100.00"), "044:0123456789"));

        assertThat(result.providerReference()).startsWith("offline-");
        assertThat(result.pendingExternalSettlement()).isFalse();
    }

    @Test
    void initiateWithdrawal_propagatesFailure_whenOfflineSettleDisabled() {
        properties.setOfflineSandboxSettle(false);
        when(kudaClient.isConfigured()).thenReturn(true);
        when(kudaClient.isSandboxMode()).thenReturn(true);
        when(kudaClient.invoke(eq("NAME_ENQUIRY"), anyMap()))
                .thenThrow(new BusinessException(
                        "KUDA_NAME_ENQUIRY_FAILED",
                        "Name Enquiry request not satisfied.",
                        org.springframework.http.HttpStatus.BAD_GATEWAY));

        assertThatThrownBy(() -> rail.initiateWithdrawal(withdrawalRequest(
                        new BigDecimal("100.00"), "044:0123456789")))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("Name Enquiry");
    }

    @Test
    void toKudaNgPhone_normalizesE164AndLocalForms() {
        assertThat(KudaPaymentRail.toKudaNgPhone("+2348012345678")).isEqualTo("08012345678");
        assertThat(KudaPaymentRail.toKudaNgPhone("2348012345678")).isEqualTo("08012345678");
        assertThat(KudaPaymentRail.toKudaNgPhone("08012345678")).isEqualTo("08012345678");
        assertThat(KudaPaymentRail.toKudaNgPhone("8012345678")).isEqualTo("08012345678");
        assertThat(KudaPaymentRail.toKudaNgPhone(null)).isEqualTo("08000000000");
    }

    @Test
    void initiateFunding_offlineSandboxSettle_whenVaPermissionDenied() {
        properties.setOfflineSandboxSettle(true);
        when(kudaClient.isConfigured()).thenReturn(true);
        when(kudaClient.isSandboxMode()).thenReturn(true);

        UUID walletId = UUID.randomUUID();
        when(virtualAccountRepository.findByWalletIdAndProviderName(walletId, KudaPaymentRail.NAME))
                .thenReturn(Optional.empty());
        when(virtualAccountRepository.save(any(PaymentVirtualAccount.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(kudaClient.invoke(eq("ADMIN_CREATE_VIRTUAL_ACCOUNT"), anyMap()))
                .thenThrow(new BusinessException(
                        "KUDA_ERROR",
                        "You do not have permission to make use of this service. Contact the API team.",
                        org.springframework.http.HttpStatus.BAD_GATEWAY));

        PaymentRailProvider.FundingInitiation result = rail.initiateFunding(fundingRequest(walletId, "1500.00"));

        assertThat(result.pendingExternalSettlement()).isFalse();
        assertThat(result.providerReference()).startsWith("offline-");
        assertThat(result.instructions()).contains("Sandbox offline settle");
        verify(kudaClient, never()).invoke(eq("ADMIN_RETRIEVE_VIRTUAL_ACCOUNT"), anyMap());
        verify(virtualAccountRepository).save(any(PaymentVirtualAccount.class));
    }

    @Test
    void initiateFunding_createsVaWithLocalNgPhone_fromE164() {
        when(kudaClient.isConfigured()).thenReturn(true);
        when(kudaClient.isSandboxMode()).thenReturn(true);

        UUID walletId = UUID.randomUUID();
        when(virtualAccountRepository.findByWalletIdAndProviderName(walletId, KudaPaymentRail.NAME))
                .thenReturn(Optional.empty());
        when(virtualAccountRepository.save(any(PaymentVirtualAccount.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        ObjectNode createResponse = objectMapper.createObjectNode();
        createResponse.put("accountNumber", "3009876543");
        createResponse.put("accountName", "PALPEER USER");
        createResponse.put("bankName", "Kuda");
        when(kudaClient.invoke(eq("ADMIN_CREATE_VIRTUAL_ACCOUNT"), anyMap())).thenReturn(createResponse);

        PaymentRailProvider.FundingInitiation result = rail.initiateFunding(
                new PaymentRailProvider.FundingInitiationRequest(
                        UUID.randomUUID(),
                        walletId,
                        UUID.randomUUID(),
                        "NGN",
                        new BigDecimal("1000.00"),
                        "ada@example.com",
                        "+2348012345678",
                        "idem-ngn-va-1",
                        "Ada",
                        "Lovelace"));

        assertThat(result.pendingExternalSettlement()).isTrue();
        assertThat(result.instructions()).contains("3009876543");

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> bodyCaptor = ArgumentCaptor.forClass(Map.class);
        verify(kudaClient).invoke(eq("ADMIN_CREATE_VIRTUAL_ACCOUNT"), bodyCaptor.capture());
        assertThat(bodyCaptor.getValue()).containsEntry("phoneNumber", "08012345678");
        assertThat(bodyCaptor.getValue()).containsEntry("email", "ada@example.com");
    }

    @Test
    void initiateFunding_retrievesExistingVa_whenCreateFails() {
        when(kudaClient.isConfigured()).thenReturn(true);
        when(kudaClient.isSandboxMode()).thenReturn(true);

        UUID walletId = UUID.randomUUID();
        when(virtualAccountRepository.findByWalletIdAndProviderName(walletId, KudaPaymentRail.NAME))
                .thenReturn(Optional.empty());
        when(virtualAccountRepository.save(any(PaymentVirtualAccount.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        when(kudaClient.invoke(eq("ADMIN_CREATE_VIRTUAL_ACCOUNT"), anyMap()))
                .thenThrow(new BusinessException(
                        "KUDA_ERROR",
                        "Duplicate tracking reference",
                        org.springframework.http.HttpStatus.BAD_GATEWAY));

        ObjectNode retrieveResponse = objectMapper.createObjectNode();
        retrieveResponse.put("AccountNumber", "3005551212");
        retrieveResponse.put("AccountName", "ADA LOVELACE");
        when(kudaClient.invoke(eq("ADMIN_RETRIEVE_VIRTUAL_ACCOUNT"), anyMap()))
                .thenReturn(retrieveResponse);

        PaymentRailProvider.FundingInitiation result = rail.initiateFunding(fundingRequest(walletId, "500.00"));

        assertThat(result.pendingExternalSettlement()).isTrue();
        assertThat(result.instructions()).contains("3005551212");
        verify(kudaClient).invoke(eq("ADMIN_RETRIEVE_VIRTUAL_ACCOUNT"), anyMap());
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
