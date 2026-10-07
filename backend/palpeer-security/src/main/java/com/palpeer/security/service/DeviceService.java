package com.palpeer.security.service;

import com.palpeer.common.audit.AuditRecord;
import com.palpeer.common.audit.AuditRecorder;
import com.palpeer.common.exception.BusinessException;
import com.palpeer.common.exception.ResourceNotFoundException;
import com.palpeer.security.domain.Device;
import com.palpeer.security.repository.DeviceRepository;
import com.palpeer.security.web.dto.DeviceResponse;
import com.palpeer.security.web.dto.RegisterDeviceRequest;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class DeviceService {

    private final DeviceRepository deviceRepository;
    private final AuditRecorder auditRecorder;

    @Transactional
    public DeviceResponse register(UUID userId, RegisterDeviceRequest request) {
        if (deviceRepository.existsByUserIdAndDeviceIdentifier(userId, request.deviceIdentifier())) {
            throw new BusinessException("DEVICE_EXISTS", "Device already registered", HttpStatus.CONFLICT);
        }

        Device device = new Device();
        device.setUserId(userId);
        device.setDeviceIdentifier(request.deviceIdentifier().trim());
        device.setPlatform(trimToNull(request.platform()));
        device.setDeviceName(trimToNull(request.deviceName()));
        device.setBiometricCredential(request.biometricCredential());
        device.setEnabled(true);
        deviceRepository.save(device);
        auditRecorder.record(AuditRecord.builder("SECURITY_DEVICE_REGISTER")
                .entity("Device:" + device.getId())
                .userRef(userId)
                .newValue("identifier=" + device.getDeviceIdentifier() + ";enabled=true")
                .build());
        return toResponse(device);
    }

    @Transactional(readOnly = true)
    public List<DeviceResponse> list(UUID userId) {
        return deviceRepository.findByUserId(userId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public DeviceResponse disable(UUID userId, UUID deviceId) {
        Device device = requireDevice(userId, deviceId);
        device.setEnabled(false);
        deviceRepository.save(device);
        auditRecorder.record(AuditRecord.builder("SECURITY_DEVICE_DISABLE")
                .entity("Device:" + device.getId())
                .userRef(userId)
                .oldValue("enabled=true")
                .newValue("enabled=false")
                .build());
        return toResponse(device);
    }

    @Transactional
    public DeviceResponse enable(UUID userId, UUID deviceId) {
        Device device = requireDevice(userId, deviceId);
        device.setEnabled(true);
        deviceRepository.save(device);
        auditRecorder.record(AuditRecord.builder("SECURITY_DEVICE_ENABLE")
                .entity("Device:" + device.getId())
                .userRef(userId)
                .oldValue("enabled=false")
                .newValue("enabled=true")
                .build());
        return toResponse(device);
    }

    @Transactional
    public void delete(UUID userId, UUID deviceId) {
        Device device = requireDevice(userId, deviceId);
        auditRecorder.record(AuditRecord.builder("SECURITY_DEVICE_DELETE")
                .entity("Device:" + device.getId())
                .userRef(userId)
                .oldValue("identifier=" + device.getDeviceIdentifier())
                .newValue("deleted=true")
                .build());
        deviceRepository.delete(device);
    }

    private Device requireDevice(UUID userId, UUID deviceId) {
        return deviceRepository.findByIdAndUserId(deviceId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Device not found"));
    }

    private DeviceResponse toResponse(Device device) {
        return new DeviceResponse(
                device.getId(),
                device.getDeviceIdentifier(),
                device.getPlatform(),
                device.getDeviceName(),
                device.isEnabled(),
                device.getLastUsedAt()
        );
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
