package com.palpeer.wallet.provider.korapay;

import com.fasterxml.jackson.databind.JsonNode;
import com.palpeer.common.exception.BusinessException;
import com.palpeer.wallet.provider.PaymentRailProvider;
import java.math.BigDecimal;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/**
 * Korapay NGN rails — bank-transfer collections for funding, disbursements for withdrawals.
 * Docs: https://developers.korapay.com/docs/bank-transfers
 *       https://developers.korapay.com/docs/payout-via-api
 *
 * <p>NGN fallback when Kuda is disabled ({@link Order} 2). InstantEX NGN prefers Kuda.
 */
@Slf4j
@Component
@Order(2)
@RequiredArgsConstructor
public class KorapayPaymentRail implements PaymentRailProvider {

    public static final String NAME = "KORAPAY";

    private final KorapayProperties properties;
    private final KorapayClient korapayClient;

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
        return korapayClient.isConfigured();
    }

    @Override
    public FundingInitiation initiateFunding(FundingInitiationRequest request) {
        requireEnabled();
        if (!"NGN".equalsIgnoreCase(request.currencyCode())) {
            throw new BusinessException(
                    "KORAPAY_CURRENCY_UNSUPPORTED",
                    "Korapay bank transfer funding supports NGN only",
                    HttpStatus.BAD_REQUEST);
        }
        if (request.amount() == null || request.amount().compareTo(new BigDecimal("100")) < 0) {
            throw new BusinessException(
                    "KORAPAY_AMOUNT_TOO_LOW",
                    "Minimum Korapay bank-transfer funding amount is NGN 100",
                    HttpStatus.BAD_REQUEST);
        }

        String reference = sanitizeReference(request.fundingTransactionId().toString());
        String customerName = joinName(request.customerFirstName(), request.customerLastName());

        try {
            JsonNode data = korapayClient.initiateBankTransfer(
                    reference,
                    request.amount(),
                    blankTo(request.userEmail(), "funding@palpeer.local"),
                    customerName,
                    true);

            String accountNumber = firstText(data.path("bank_account"), "account_number", "accountNumber");
            String accountName = firstText(data.path("bank_account"), "account_name", "accountName");
            String bankName = firstText(data.path("bank_account"), "bank_name", "bankName");
            String bankCode = firstText(data.path("bank_account"), "bank_code", "bankCode");
            String providerRef = firstNonBlank(text(data, "reference"), text(data, "payment_reference"), reference);

            boolean settledInSandbox = false;
            if (korapayClient.isSandboxMode()
                    && properties.isAutoSandboxCredit()
                    && notBlank(accountNumber)) {
                korapayClient.sandboxCredit(accountNumber, request.amount());
                JsonNode charge = korapayClient.getCharge(providerRef);
                String status = text(charge, "status");
                settledInSandbox = status != null && "success".equalsIgnoreCase(status.trim());
                if (!settledInSandbox) {
                    log.warn("Korapay sandbox credit did not reach success yet; status={} ref={}", status, providerRef);
                }
            }

            String instructions;
            if (settledInSandbox) {
                instructions = "Sandbox payment completed. NGN "
                        + request.amount()
                        + " will be credited to your wallet. Ref="
                        + providerRef;
            } else {
                instructions = "Transfer NGN "
                        + request.amount()
                        + " to "
                        + nullToEmpty(bankName)
                        + " account "
                        + nullToEmpty(accountNumber)
                        + " ("
                        + nullToEmpty(accountName)
                        + ")"
                        + (notBlank(bankCode) ? "; bankCode=" + bankCode : "")
                        + "; ref="
                        + providerRef
                        + ". Your balance updates once Korapay confirms the payment.";
            }

            // false → FundingService CREDITS the NGN wallet immediately after sandbox success.
            return new FundingInitiation(providerRef, instructions, !settledInSandbox);
        } catch (BusinessException ex) {
            if (korapayClient.isSandboxMode() && properties.isOfflineSandboxSettle()) {
                log.warn(
                        "Korapay unreachable in sandbox — settling NGN funding locally. cause={}",
                        ex.getMessage());
                String offlineRef = "offline-" + reference;
                String instructions = "Sandbox offline settle. NGN "
                        + request.amount()
                        + " credited to your wallet. Ref="
                        + offlineRef;
                return new FundingInitiation(offlineRef, instructions, false);
            }
            throw ex;
        }
    }

    @Override
    public WithdrawalInitiation initiateWithdrawal(WithdrawalInitiationRequest request) {
        requireEnabled();
        if (!"NGN".equalsIgnoreCase(request.currencyCode())) {
            throw new BusinessException(
                    "KORAPAY_CURRENCY_UNSUPPORTED",
                    "Korapay withdrawals support NGN only",
                    HttpStatus.BAD_REQUEST);
        }
        if (request.amount() == null || request.amount().compareTo(new BigDecimal("100")) < 0) {
            throw new BusinessException(
                    "KORAPAY_AMOUNT_TOO_LOW",
                    "Minimum Korapay withdrawal amount is NGN 100",
                    HttpStatus.BAD_REQUEST);
        }

        ParsedDestination destination = parseDestination(request.destinationReference());
        String reference = sanitizeReference(request.withdrawalTransactionId().toString());
        String customerName = blankTo(request.customerName(), "PALPEER Customer");
        String customerEmail = blankTo(request.userEmail(), "withdrawal@palpeer.local");

        try {
            JsonNode data = korapayClient.disburse(
                    reference,
                    request.amount(),
                    destination.bankCode(),
                    destination.accountNumber(),
                    customerEmail,
                    customerName);

            String providerRef = firstNonBlank(text(data, "reference"), reference);
            String status = text(data, "status");
            boolean successStatus = status != null && "success".equalsIgnoreCase(status.trim());

            // Sandbox: settle immediately so demos don't wait on transfer webhooks.
            boolean settleNow = successStatus
                    || (korapayClient.isSandboxMode() && properties.isAutoSandboxSettle());
            if (settleNow) {
                log.info(
                        "Korapay withdrawal settled (sandbox/success). ref={} status={}",
                        providerRef,
                        status);
            }
            return new WithdrawalInitiation(providerRef, !settleNow);
        } catch (BusinessException ex) {
            if (korapayClient.isSandboxMode() && properties.isOfflineSandboxSettle()) {
                log.warn(
                        "Korapay unreachable in sandbox — settling NGN withdrawal locally. cause={}",
                        ex.getMessage());
                return new WithdrawalInitiation("offline-" + reference, false);
            }
            throw ex;
        }
    }

    private static ParsedDestination parseDestination(String destinationReference) {
        if (destinationReference == null || destinationReference.isBlank()) {
            throw new BusinessException(
                    "KORAPAY_DESTINATION_REQUIRED",
                    "NGN withdrawal destinationReference must be bankCode:accountNumber",
                    HttpStatus.BAD_REQUEST);
        }
        String[] parts = destinationReference.trim().split("[:|;]");
        if (parts.length < 2
                || parts[0].isBlank()
                || parts[1].isBlank()) {
            throw new BusinessException(
                    "KORAPAY_DESTINATION_INVALID",
                    "NGN destinationReference format: bankCode:accountNumber",
                    HttpStatus.BAD_REQUEST);
        }
        return new ParsedDestination(parts[0].trim(), parts[1].trim());
    }

    private record ParsedDestination(String bankCode, String accountNumber) {
    }

    private void requireEnabled() {
        if (!isEnabled()) {
            throw new BusinessException(
                    "KORAPAY_DISABLED",
                    "Korapay is not configured (KORAPAY_ENABLED + KORAPAY_SECRET_KEY)",
                    HttpStatus.SERVICE_UNAVAILABLE);
        }
    }

    /** Korapay requires references at least 8 characters; strip hyphens from UUIDs. */
    static String sanitizeReference(String raw) {
        String value = raw == null ? "" : raw.replace("-", "").trim();
        if (value.length() < 8) {
            value = ("pp" + value + "00000000").substring(0, 16);
        }
        return value.length() > 64 ? value.substring(0, 64) : value;
    }

    private static String joinName(String first, String last) {
        String name = ((first == null ? "" : first) + " " + (last == null ? "" : last)).trim();
        return name.isBlank() ? "PALPEER Customer" : name;
    }

    private static String firstText(JsonNode node, String... fields) {
        for (String field : fields) {
            String value = text(node, field);
            if (notBlank(value)) {
                return value;
            }
        }
        return null;
    }

    private static String text(JsonNode node, String field) {
        if (node == null || node.isMissingNode() || node.isNull()) {
            return null;
        }
        JsonNode child = node.path(field);
        return child.isMissingNode() || child.isNull() ? null : child.asText();
    }

    private static String firstNonBlank(String... values) {
        for (String value : values) {
            if (notBlank(value)) {
                return value;
            }
        }
        return null;
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
}
