package com.palpeer.wallet.provider.kuda;

import com.fasterxml.jackson.databind.JsonNode;
import com.palpeer.common.exception.BusinessException;
import com.palpeer.wallet.domain.PaymentVirtualAccount;
import com.palpeer.wallet.provider.PaymentRailProvider;
import com.palpeer.wallet.repository.PaymentVirtualAccountRepository;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Kuda NGN rails — virtual account collections for funding, SINGLE_FUND_TRANSFER for withdrawals.
 * Preferred InstantEX NGN rail ({@link Order} 1). Korapay remains available when enabled as Order 2.
 *
 * <p>Default funding path (sandbox and live): create/reuse a per-wallet VA, return transfer
 * instructions, leave the funding {@code PENDING} until an inbound credit webhook settles the
 * wallet. Optional sandbox shortcut {@code KUDA_DEMO_FUND_ENABLED} calls
 * {@code FUND_VIRTUAL_ACCOUNT} and may settle immediately for eng demos.
 * Docs: https://kuda.com/business/open-api/
 */
@Slf4j
@Component
@Order(1)
@RequiredArgsConstructor
public class KudaPaymentRail implements PaymentRailProvider {

    public static final String NAME = "KUDA";

    private final KudaProperties properties;
    private final KudaClient kudaClient;
    private final PaymentVirtualAccountRepository virtualAccountRepository;

    @Override
    public String providerName() {
        return NAME;
    }

    @Override
    public Set<String> supportedCurrencies() {
        return Set.of("NGN");
    }

    @Override
    public boolean isEnabled() {
        return kudaClient.isConfigured();
    }

    @Override
    @Transactional
    public FundingInitiation initiateFunding(FundingInitiationRequest request) {
        requireEnabled();
        try {
            PaymentVirtualAccount account = virtualAccountRepository
                    .findByWalletIdAndProviderName(request.walletId(), NAME)
                    .orElseGet(() -> createVirtualAccount(request));

            if (!notBlank(account.getAccountNumber())) {
                throw new BusinessException(
                        "KUDA_ERROR",
                        "Kuda virtual account has no account number",
                        HttpStatus.BAD_GATEWAY);
            }

            // Optional sandbox shortcut: credit the VA via Kuda FUND_VIRTUAL_ACCOUNT (eng demos).
            // Default path is customer bank transfer → webhook settle (live and sandbox alike).
            if (kudaClient.isSandboxMode() && properties.isDemoFundEnabled()) {
                return demoFundVirtualAccount(request, account);
            }

            // Real payment process: return VA details and stay PENDING until inbound credit + webhook.
            String instructions = transferInstructions(
                    request, account, request.fundingTransactionId().toString());
            return new FundingInitiation(
                    request.fundingTransactionId().toString(), instructions, true);
        } catch (BusinessException ex) {
            if (kudaClient.isSandboxMode() && properties.isOfflineSandboxSettle()) {
                // Keep the funding pending with whatever VA we already have — never silent-credit.
                return virtualAccountRepository
                        .findByWalletIdAndProviderName(request.walletId(), NAME)
                        .map(account -> {
                            log.warn(
                                    "Kuda unreachable in sandbox — leaving NGN funding PENDING with VA. cause={}",
                                    ex.getMessage());
                            String ref = request.fundingTransactionId().toString();
                            return new FundingInitiation(
                                    ref, transferInstructions(request, account, ref), true);
                        })
                        .orElseThrow(() -> ex);
            }
            throw ex;
        }
    }

    /**
     * Official Kuda demo/test funding: move funds from the business main account into the VA
     * ({@code FUND_VIRTUAL_ACCOUNT}). Amount is in kobo.
     */
    private FundingInitiation demoFundVirtualAccount(
            FundingInitiationRequest request, PaymentVirtualAccount account) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("trackingReference", account.getTrackingReference());
        payload.put("amount", kudaClient.toKobo(request.amount()));
        payload.put(
                "narration",
                "PALPEER demo funding " + request.fundingTransactionId().toString().replace("-", "").substring(0, 12));

        JsonNode response = kudaClient.invoke("FUND_VIRTUAL_ACCOUNT", payload);
        String reference = firstText(
                response,
                "transactionReference",
                "TransactionReference",
                "reference",
                "Reference",
                "requestReference",
                "RequestReference");
        if (reference == null) {
            reference = request.fundingTransactionId().toString();
        }

        // Demo fund credits the VA on Kuda's side for eng tests, but the Palpeer wallet must still
        // wait for webhook/operator settle — never return pendingExternalSettlement=false here.
        String instructions = "Kuda demo funding submitted (FUND_VIRTUAL_ACCOUNT). NGN "
                + request.amount()
                + " to VA "
                + account.getAccountNumber()
                + "; tracking="
                + account.getTrackingReference()
                + "; ref="
                + reference
                + ". Waiting for confirmation.";
        log.info(
                "Kuda demo FUND_VIRTUAL_ACCOUNT submitted (wallet stays PENDING). va={} amount={} ref={}",
                account.getAccountNumber(),
                request.amount(),
                reference);
        return new FundingInitiation(reference, instructions, true);
    }

    private static String transferInstructions(
            FundingInitiationRequest request, PaymentVirtualAccount account, String reference) {
        return "Transfer NGN "
                + request.amount()
                + " to Kuda virtual account "
                + nullToEmpty(account.getAccountNumber())
                + " ("
                + nullToEmpty(account.getAccountName())
                + ")"
                + "; bank="
                + nullToEmpty(account.getBankName())
                + "; tracking="
                + account.getTrackingReference()
                + "; ref="
                + reference
                + ". Your balance updates once Kuda confirms the credit.";
    }

    @Override
    public WithdrawalInitiation initiateWithdrawal(WithdrawalInitiationRequest request) {
        requireEnabled();
        ParsedDestination destination = parseDestination(request.destinationReference());

        JsonNode enquiry = kudaClient.invoke(
                "NAME_ENQUIRY",
                Map.of(
                        "beneficiaryAccountNumber", destination.accountNumber(),
                        "beneficiaryBankCode", destination.bankCode()));
        String sessionId = firstText(enquiry, "SessionID", "sessionID", "NameEnquirySessionID");
        String beneficiaryName = firstText(enquiry, "BeneficiaryName", "beneficiaryName", "AccountName");
        if (sessionId == null || beneficiaryName == null) {
            throw new BusinessException(
                    "KUDA_NAME_ENQUIRY_FAILED",
                    "Kuda name enquiry did not return session/beneficiary name",
                    HttpStatus.BAD_GATEWAY);
        }

        Map<String, Object> transfer = new HashMap<>();
        transfer.put("beneficiarybankCode", destination.bankCode());
        transfer.put("beneficiaryAccount", destination.accountNumber());
        transfer.put("beneficiaryName", beneficiaryName);
        transfer.put("amount", kudaClient.toKobo(request.amount()));
        transfer.put("narration", "PALPEER withdrawal " + request.withdrawalTransactionId());
        transfer.put("nameEnquirySessionID", sessionId);
        transfer.put("trackingReference", request.idempotencyKey());
        transfer.put("senderName", properties.getSenderName());

        JsonNode response = kudaClient.invoke("SINGLE_FUND_TRANSFER", transfer);
        String reference = firstText(
                response, "transactionReference", "TransactionReference", "requestRef", "RequestRef");
        if (reference == null) {
            reference = request.withdrawalTransactionId().toString();
        }

        // Real payout process: SINGLE_FUND_TRANSFER submitted; wallet stays PENDING until webhook.
        log.info("Kuda NGN withdrawal submitted. ref={}", reference);
        return new WithdrawalInitiation(reference, true);
    }

    private PaymentVirtualAccount createVirtualAccount(FundingInitiationRequest request) {
        String tracking = "pp" + request.walletId().toString().replace("-", "").substring(0, 16);
        String firstName = blankTo(request.customerFirstName(), "PALPEER");
        String lastName = blankTo(request.customerLastName(), "USER");

        Map<String, Object> payload = new HashMap<>();
        payload.put("email", blankTo(request.userEmail(), "funding@palpeer.local"));
        payload.put("phoneNumber", blankTo(request.userPhone(), "08000000000"));
        payload.put("firstName", firstName);
        payload.put("lastName", lastName);
        payload.put("trackingReference", tracking);

        JsonNode response = kudaClient.invoke("ADMIN_CREATE_VIRTUAL_ACCOUNT", payload);
        String accountNumber = firstText(response, "accountNumber", "AccountNumber", "number");
        if (!notBlank(accountNumber)) {
            throw new BusinessException(
                    "KUDA_ERROR",
                    "Kuda did not return a virtual account number",
                    HttpStatus.BAD_GATEWAY);
        }

        PaymentVirtualAccount account = new PaymentVirtualAccount();
        account.setUserId(request.userId());
        account.setWalletId(request.walletId());
        account.setCurrencyCode("NGN");
        account.setProviderName(NAME);
        account.setTrackingReference(tracking);
        account.setAccountNumber(accountNumber);
        account.setAccountName(firstText(response, "accountName", "AccountName", "fullname"));
        account.setBankCode(firstText(response, "bankCode", "BankCode"));
        account.setBankName(firstNonNull(firstText(response, "bankName", "BankName"), "Kuda"));
        account.setActive(true);
        return virtualAccountRepository.save(account);
    }

    private void requireEnabled() {
        if (!isEnabled()) {
            throw new BusinessException(
                    "KUDA_DISABLED",
                    "Kuda is not configured (KUDA_ENABLED + KUDA_EMAIL + KUDA_API_KEY)",
                    HttpStatus.SERVICE_UNAVAILABLE);
        }
    }

    private static ParsedDestination parseDestination(String destinationReference) {
        if (destinationReference == null || destinationReference.isBlank()) {
            throw new BusinessException(
                    "KUDA_DESTINATION_REQUIRED",
                    "NGN withdrawal destinationReference must be bankCode:accountNumber",
                    HttpStatus.BAD_REQUEST);
        }
        String[] parts = destinationReference.trim().split("[:|;]");
        if (parts.length < 2) {
            throw new BusinessException(
                    "KUDA_DESTINATION_INVALID",
                    "NGN destinationReference format: bankCode:accountNumber",
                    HttpStatus.BAD_REQUEST);
        }
        return new ParsedDestination(parts[0].trim(), parts[1].trim());
    }

    private static String firstText(JsonNode node, String... fields) {
        if (node == null) {
            return null;
        }
        for (String field : fields) {
            JsonNode direct = node.path(field);
            if (!direct.isMissingNode() && !direct.isNull() && notBlank(direct.asText())) {
                return direct.asText();
            }
            JsonNode nested = node.path("data").path(field);
            if (!nested.isMissingNode() && !nested.isNull() && notBlank(nested.asText())) {
                return nested.asText();
            }
            JsonNode dataCaps = node.path("Data").path(field);
            if (!dataCaps.isMissingNode() && !dataCaps.isNull() && notBlank(dataCaps.asText())) {
                return dataCaps.asText();
            }
        }
        return null;
    }

    private static String firstNonNull(String a, String b) {
        return notBlank(a) ? a : b;
    }

    private static String blankTo(String value, String fallback) {
        return notBlank(value) ? value.trim() : fallback;
    }

    private static String nullToEmpty(String value) {
        return value == null ? "" : value;
    }

    private static boolean notBlank(String value) {
        return value != null && !value.isBlank();
    }

    private record ParsedDestination(String bankCode, String accountNumber) {}
}
