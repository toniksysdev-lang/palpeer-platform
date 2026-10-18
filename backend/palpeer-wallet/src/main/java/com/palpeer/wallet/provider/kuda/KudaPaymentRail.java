package com.palpeer.wallet.provider.kuda;

import com.fasterxml.jackson.databind.JsonNode;
import com.palpeer.common.exception.BusinessException;
import com.palpeer.wallet.domain.PaymentVirtualAccount;
import com.palpeer.wallet.provider.PaymentRailProvider;
import com.palpeer.wallet.repository.PaymentVirtualAccountRepository;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Kuda NGN rails — virtual account collections for funding, SINGLE_FUND_TRANSFER for withdrawals.
 * Kept alongside Korapay; used when Korapay is disabled ({@link Order} 2).
 */
@Slf4j
@Component
@Order(2)
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
        PaymentVirtualAccount account = virtualAccountRepository
                .findByWalletIdAndProviderName(request.walletId(), NAME)
                .orElseGet(() -> createVirtualAccount(request));

        String instructions = "Transfer NGN " + request.amount()
                + " to Kuda virtual account "
                + nullToEmpty(account.getAccountNumber())
                + " (" + nullToEmpty(account.getAccountName()) + ")"
                + "; bank=" + nullToEmpty(account.getBankName())
                + "; tracking=" + account.getTrackingReference()
                + "; ref=" + request.fundingTransactionId();

        return new FundingInitiation(
                request.fundingTransactionId().toString(),
                instructions,
                true);
    }

    @Override
    public WithdrawalInitiation initiateWithdrawal(WithdrawalInitiationRequest request) {
        requireEnabled();
        ParsedDestination destination = parseDestination(request.destinationReference());

        JsonNode enquiry = kudaClient.invoke("NAME_ENQUIRY", Map.of(
                "beneficiaryAccountNumber", destination.accountNumber(),
                "beneficiaryBankCode", destination.bankCode()
        ));
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
        String reference = firstText(response, "transactionReference", "TransactionReference", "requestRef");
        if (reference == null) {
            reference = request.withdrawalTransactionId().toString();
        }
        return new WithdrawalInitiation(reference, true);
    }

    private PaymentVirtualAccount createVirtualAccount(FundingInitiationRequest request) {
        String tracking = "pp" + request.walletId().toString().replace("-", "").substring(0, 16);
        String firstName = blankTo(request.customerFirstName(), "PALPEER");
        String lastName = blankTo(request.customerLastName(), "USER");

        Map<String, Object> payload = new HashMap<>();
        payload.put("email", request.userEmail());
        payload.put("phoneNumber", blankTo(request.userPhone(), "00000000000"));
        payload.put("firstName", firstName);
        payload.put("lastName", lastName);
        payload.put("trackingReference", tracking);

        JsonNode response = kudaClient.invoke("ADMIN_CREATE_VIRTUAL_ACCOUNT", payload);
        PaymentVirtualAccount account = new PaymentVirtualAccount();
        account.setUserId(request.userId());
        account.setWalletId(request.walletId());
        account.setCurrencyCode("NGN");
        account.setProviderName(NAME);
        account.setTrackingReference(tracking);
        account.setAccountNumber(firstText(response, "accountNumber", "AccountNumber", "number"));
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

    private record ParsedDestination(String bankCode, String accountNumber) {
    }
}
