package com.palpeer.notification.push;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.palpeer.notification.domain.DeviceToken;
import com.palpeer.notification.domain.Notification;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/**
 * Expo push tokens ({@code ExponentPushToken[...]} / {@code ExpoPushToken[...]}) via Expo Push API.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ExpoPushNotifier {

    private static final String EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

    private final RestClient.Builder restClientBuilder;
    private final ObjectMapper objectMapper;

    static boolean isExpoToken(String token) {
        if (token == null || token.isBlank()) {
            return false;
        }
        String trimmed = token.trim();
        return trimmed.startsWith("ExponentPushToken")
                || trimmed.startsWith("ExpoPushToken");
    }

    public void send(DeviceToken deviceToken, Notification notification) {
        ObjectNode message = objectMapper.createObjectNode();
        message.put("to", deviceToken.getToken().trim());
        message.put("title", notification.getTitle());
        message.put("body", notification.getBody());
        message.put("sound", "default");

        ObjectNode data = objectMapper.createObjectNode();
        for (Map.Entry<String, String> entry : FcmPushNotifier.buildData(notification).entrySet()) {
            data.put(entry.getKey(), entry.getValue());
        }
        message.set("data", data);

        ArrayNode body = objectMapper.createArrayNode();
        body.add(message);

        RestClient client = restClientBuilder.build();
        JsonNode response = client.post()
                .uri(EXPO_PUSH_URL)
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .body(JsonNode.class);

        if (response == null) {
            throw new RuntimeException("Expo push returned empty response");
        }
        JsonNode dataNode = response.path("data");
        if (dataNode.isArray() && !dataNode.isEmpty()) {
            JsonNode first = dataNode.get(0);
            String status = first.path("status").asText("");
            if ("error".equalsIgnoreCase(status)) {
                String detail = first.path("message").asText("unknown error");
                throw new RuntimeException("Expo push failed: " + detail);
            }
        }
        log.debug(
                "Expo push accepted notificationId={} user={}",
                notification.getId(),
                notification.getUserId());
    }
}
