package com.palpeer.wallet.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.palpeer.wallet.funding.FundingService;
import com.palpeer.wallet.provider.apaylo.ApayloProperties;
import com.palpeer.wallet.provider.korapay.KorapayProperties;
import com.palpeer.wallet.provider.kuda.KudaPaymentRail;
import com.palpeer.wallet.provider.kuda.KudaProperties;
import com.palpeer.wallet.withdrawal.WithdrawalService;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.HexFormat;
import java.util.UUID;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockHttpServletRequest;

@ExtendWith(MockitoExtension.class)
class PaymentWebhookControllerTest {

    private static final String SECRET = "test-kuda-secret";
    private static final String HEADER = "X-Webhook-Signature";
    private static final String WEBHOOK_USER = "kuda-hook-user";
    private static final String WEBHOOK_PASS = "kuda-hook-pass";

    @Mock private FundingService fundingService;
    @Mock private WithdrawalService withdrawalService;

    private KudaProperties kudaProperties;
    private PaymentWebhookController controller;

    @BeforeEach
    void setUp() {
        kudaProperties = new KudaProperties();
        kudaProperties.setWebhookSecret(SECRET);
        controller = new PaymentWebhookController(
                fundingService,
                withdrawalService,
                new ObjectMapper(),
                new ApayloProperties(),
                new KorapayProperties(),
                kudaProperties);
    }

    @Test
    void rejectsUnsignedWebhook() {
        String body = fundingBody(UUID.randomUUID(), "SUCCESS");

        var response = controller.kuda(body, new MockHttpServletRequest());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        verifyNoInteractions(fundingService, withdrawalService);
    }

    @Test
    void rejectsWrongSignature() {
        String body = fundingBody(UUID.randomUUID(), "SUCCESS");

        var response = controller.kuda(body, signed(sign("other-secret", body)));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        verifyNoInteractions(fundingService, withdrawalService);
    }

    @Test
    void rejectsEverythingWhenNoSecretConfigured() {
        String body = fundingBody(UUID.randomUUID(), "SUCCESS");

        var response = controller.apaylo(body, signed(sign("", body)));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        verifyNoInteractions(fundingService, withdrawalService);
    }

    @Test
    void processesCorrectlySignedWebhook() {
        UUID fundingId = UUID.randomUUID();
        String body = fundingBody(fundingId, "SUCCESS");

        var response = controller.kuda(body, signed("sha256=" + sign(SECRET, body)));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        verify(fundingService).completeById(eq(fundingId), eq(true), any());
    }

    @Test
    void acceptsKudaUsernamePasswordHeaders() {
        kudaProperties.setWebhookSecret("");
        kudaProperties.setWebhookUsername(WEBHOOK_USER);
        kudaProperties.setWebhookPassword(WEBHOOK_PASS);

        UUID fundingId = UUID.randomUUID();
        String body = fundingBody(fundingId, "SUCCESS");
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("username", WEBHOOK_USER);
        request.addHeader(
                "password",
                Base64.getEncoder().encodeToString(WEBHOOK_PASS.getBytes(StandardCharsets.UTF_8)));

        var response = controller.kuda(body, request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        verify(fundingService).completeById(eq(fundingId), eq(true), any());
    }

    @Test
    void creditsVirtualAccountFromTransactionNotification() {
        kudaProperties.setWebhookSecret("");
        kudaProperties.setWebhookUsername(WEBHOOK_USER);
        kudaProperties.setWebhookPassword(WEBHOOK_PASS);

        String body = """
                {
                  "eventType":"Transaction.Notification",
                  "amount":36000,
                  "transactionReference":"231208609730",
                  "accountNumber":"2050000000",
                  "transactionType":"Credit"
                }
                """;
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("username", WEBHOOK_USER);
        request.addHeader(
                "password",
                Base64.getEncoder().encodeToString(WEBHOOK_PASS.getBytes(StandardCharsets.UTF_8)));

        var response = controller.kuda(body, request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        verify(fundingService)
                .completePendingVirtualAccountCredit(
                        eq(KudaPaymentRail.NAME),
                        eq("2050000000"),
                        eq(new BigDecimal("360.00")),
                        eq("231208609730"),
                        eq(true),
                        eq(null));
    }

    @Test
    void missingStatusIsIgnoredInsteadOfTreatedAsSuccess() {
        String body = "{\"fundingId\":\"" + UUID.randomUUID() + "\"}";

        var response = controller.kuda(body, signed(sign(SECRET, body)));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        verifyNoInteractions(fundingService, withdrawalService);
    }

    @Test
    void pendingStatusDoesNotFailTheTransaction() {
        String body = fundingBody(UUID.randomUUID(), "PENDING");

        controller.kuda(body, signed(sign(SECRET, body)));

        verify(fundingService, never()).completeById(any(), anyBoolean(), any());
    }

    private static String fundingBody(UUID fundingId, String status) {
        return "{\"fundingId\":\"" + fundingId + "\",\"status\":\"" + status + "\"}";
    }

    private static MockHttpServletRequest signed(String signature) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader(HEADER, signature);
        return request;
    }

    private static String sign(String secret, String body) {
        if (secret.isEmpty()) {
            return "deadbeef";
        }
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal(body.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception ex) {
            throw new IllegalStateException(ex);
        }
    }
}
