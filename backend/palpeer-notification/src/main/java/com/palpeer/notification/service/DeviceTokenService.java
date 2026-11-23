package com.palpeer.notification.service;

import com.palpeer.common.exception.BusinessException;
import com.palpeer.common.exception.ResourceNotFoundException;
import com.palpeer.notification.domain.DeviceToken;
import com.palpeer.notification.domain.DeviceTokenPlatform;
import com.palpeer.notification.repository.DeviceTokenRepository;
import com.palpeer.notification.web.dto.DeviceTokenResponse;
import com.palpeer.notification.web.dto.RegisterDeviceTokenRequest;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class DeviceTokenService {

    private static final Pattern RAW_APNS_HEX =
            Pattern.compile("(?i)^[0-9a-f]{64}$");

    private final DeviceTokenRepository deviceTokenRepository;

    /**
     * Register or refresh a push token. Same token reassigned to current user if previously owned elsewhere.
     * CONTRACT_PENDING (P12-01): multi-device limits and token reassignment policy.
     */
    @Transactional
    public DeviceTokenResponse register(UUID userId, RegisterDeviceTokenRequest request) {
        String token = request.token().trim();
        rejectUndeliverableToken(token, request.platform());
        DeviceToken deviceToken = deviceTokenRepository.findByToken(token).orElseGet(DeviceToken::new);
        deviceToken.setUserId(userId);
        deviceToken.setToken(token);
        deviceToken.setPlatform(request.platform());
        deviceToken.setDeviceIdentifier(trimToNull(request.deviceIdentifier()));
        deviceToken.setEnabled(true);
        deviceToken.setLastSeenAt(Instant.now());
        deviceTokenRepository.save(deviceToken);
        return toResponse(deviceToken);
    }

    /**
     * Expo tokens go through Expo Push API; native tokens through FCM Admin. Raw APNs hex is not a
     * valid FCM registration token — accepting it only produces INVALID_ARGUMENT and a disabled row.
     */
    static void rejectUndeliverableToken(String token, DeviceTokenPlatform platform) {
        if (token == null || token.isBlank()) {
            throw new BusinessException(
                    "DEVICE_TOKEN_INVALID", "Push token is required", HttpStatus.BAD_REQUEST);
        }
        String trimmed = token.trim();
        if (trimmed.startsWith("ExponentPushToken") || trimmed.startsWith("ExpoPushToken")) {
            return;
        }
        String compact = trimmed.replaceAll("\\s+", "");
        if (platform == DeviceTokenPlatform.IOS && RAW_APNS_HEX.matcher(compact).matches()) {
            throw new BusinessException(
                    "DEVICE_TOKEN_UNSUPPORTED",
                    "Raw APNs device tokens are not supported. Register an Expo push token instead.",
                    HttpStatus.BAD_REQUEST);
        }
    }

    @Transactional(readOnly = true)
    public List<DeviceTokenResponse> list(UUID userId) {
        return deviceTokenRepository.findByUserIdOrderByUpdatedAtDesc(userId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public DeviceTokenResponse disable(UUID userId, UUID tokenId) {
        DeviceToken deviceToken = requireOwned(userId, tokenId);
        deviceToken.setEnabled(false);
        deviceTokenRepository.save(deviceToken);
        return toResponse(deviceToken);
    }

    @Transactional
    public void delete(UUID userId, UUID tokenId) {
        DeviceToken deviceToken = requireOwned(userId, tokenId);
        deviceTokenRepository.delete(deviceToken);
    }

    private DeviceToken requireOwned(UUID userId, UUID tokenId) {
        return deviceTokenRepository.findByIdAndUserId(tokenId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Device token not found"));
    }

    private DeviceTokenResponse toResponse(DeviceToken deviceToken) {
        return new DeviceTokenResponse(
                deviceToken.getId(),
                deviceToken.getPlatform(),
                deviceToken.getDeviceIdentifier(),
                deviceToken.isEnabled(),
                deviceToken.getLastSeenAt(),
                deviceToken.getCreatedAt(),
                deviceToken.getUpdatedAt());
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
