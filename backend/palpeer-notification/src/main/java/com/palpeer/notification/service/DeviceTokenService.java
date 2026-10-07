package com.palpeer.notification.service;

import com.palpeer.common.exception.ResourceNotFoundException;
import com.palpeer.notification.domain.DeviceToken;
import com.palpeer.notification.repository.DeviceTokenRepository;
import com.palpeer.notification.web.dto.DeviceTokenResponse;
import com.palpeer.notification.web.dto.RegisterDeviceTokenRequest;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class DeviceTokenService {

    private final DeviceTokenRepository deviceTokenRepository;

    /**
     * Register or refresh a push token. Same token reassigned to current user if previously owned elsewhere.
     * CONTRACT_PENDING (P12-01): multi-device limits and token reassignment policy.
     */
    @Transactional
    public DeviceTokenResponse register(UUID userId, RegisterDeviceTokenRequest request) {
        String token = request.token().trim();
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
