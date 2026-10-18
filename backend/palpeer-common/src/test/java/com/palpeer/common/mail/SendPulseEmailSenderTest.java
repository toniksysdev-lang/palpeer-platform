package com.palpeer.common.mail;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class SendPulseEmailSenderTest {

    private HttpServer server;
    private String baseUrl;
    private final AtomicInteger oauthCalls = new AtomicInteger();
    private final AtomicInteger sendCalls = new AtomicInteger();
    private final AtomicReference<String> lastAuth = new AtomicReference<>();
    private final AtomicReference<String> lastBody = new AtomicReference<>();

    @BeforeEach
    void startServer() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext(
                "/oauth/access_token",
                exchange -> {
                    oauthCalls.incrementAndGet();
                    byte[] json =
                            "{\"access_token\":\"test-token\",\"token_type\":\"Bearer\",\"expires_in\":3600}"
                                    .getBytes(StandardCharsets.UTF_8);
                    exchange.getResponseHeaders().add("Content-Type", "application/json");
                    exchange.sendResponseHeaders(200, json.length);
                    try (OutputStream os = exchange.getResponseBody()) {
                        os.write(json);
                    }
                });
        server.createContext(
                "/smtp/emails",
                exchange -> {
                    sendCalls.incrementAndGet();
                    lastAuth.set(exchange.getRequestHeaders().getFirst("Authorization"));
                    lastBody.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
                    byte[] json = "{\"result\":true,\"id\":\"msg-1\"}".getBytes(StandardCharsets.UTF_8);
                    exchange.getResponseHeaders().add("Content-Type", "application/json");
                    exchange.sendResponseHeaders(200, json.length);
                    try (OutputStream os = exchange.getResponseBody()) {
                        os.write(json);
                    }
                });
        server.setExecutor(Executors.newCachedThreadPool());
        server.start();
        baseUrl = "http://127.0.0.1:" + server.getAddress().getPort();
    }

    @AfterEach
    void stopServer() {
        if (server != null) {
            server.stop(0);
        }
    }

    @Test
    void send_obtainsTokenAndPostsBase64Html() {
        SendPulseMailProperties sendPulse = new SendPulseMailProperties();
        sendPulse.setClientId("client-id");
        sendPulse.setClientSecret("client-secret");
        sendPulse.setBaseUrl(baseUrl);

        PalpeerMailProperties mail = new PalpeerMailProperties();
        mail.setFrom("noreply@palpeer.com.ng");
        mail.setFromName("PALPEER");

        SendPulseEmailSender sender = new SendPulseEmailSender(sendPulse, mail);
        String html = "<p>hi <img src=\"" + EmailBrand.LOGO_CID_SRC + "\"/></p>";
        sender.send("user@example.com", "OTP", "text body", html);

        assertThat(oauthCalls.get()).isEqualTo(1);
        assertThat(sendCalls.get()).isEqualTo(1);
        assertThat(lastAuth.get()).isEqualTo("Bearer test-token");
        assertThat(lastBody.get()).contains("\"subject\":\"OTP\"");
        assertThat(lastBody.get()).contains("user@example.com");
        // HTML is base64; logo cid should have been rewritten before encoding
        assertThat(lastBody.get()).doesNotContain(EmailBrand.LOGO_CID_SRC);
        String htmlB64 =
                lastBody.get().replaceAll("(?s).*\"html\"\\s*:\\s*\"([^\"]+)\".*", "$1");
        String decoded = new String(Base64.getDecoder().decode(htmlB64), StandardCharsets.UTF_8);
        assertThat(decoded).contains("data:image/png;base64,");
    }

    @Test
    void send_withoutCredentials_failsFast() {
        SendPulseMailProperties sendPulse = new SendPulseMailProperties();
        sendPulse.setBaseUrl(baseUrl);
        PalpeerMailProperties mail = new PalpeerMailProperties();
        SendPulseEmailSender sender = new SendPulseEmailSender(sendPulse, mail);
        assertThatThrownBy(() -> sender.send("a@b.com", "s", "t", null))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("SendPulse is not configured");
    }

    @Test
    void prepareHtml_leavesBodyWithoutCidUnchanged() {
        SendPulseMailProperties sendPulse = new SendPulseMailProperties();
        sendPulse.setClientId("id");
        sendPulse.setClientSecret("secret");
        SendPulseEmailSender sender = new SendPulseEmailSender(sendPulse, new PalpeerMailProperties());
        assertThat(sender.prepareHtml("<p>plain</p>")).isEqualTo("<p>plain</p>");
    }
}
