package com.palpeer.security.web;

import com.palpeer.auth.security.UserPrincipal;
import com.palpeer.common.api.ApiResponse;
import com.palpeer.security.service.DeviceService;
import com.palpeer.security.service.PinService;
import com.palpeer.security.service.SecurityQuestionService;
import com.palpeer.security.web.dto.ChangePinRequest;
import com.palpeer.security.web.dto.DeviceResponse;
import com.palpeer.security.web.dto.PinStatusResponse;
import com.palpeer.security.web.dto.RegisterDeviceRequest;
import com.palpeer.security.web.dto.ResetPinRequest;
import com.palpeer.security.web.dto.SecurityQuestionResponse;
import com.palpeer.security.web.dto.SetPinRequest;
import com.palpeer.security.web.dto.SetSecurityQuestionsRequest;
import com.palpeer.security.web.dto.VerifyPinRequest;
import com.palpeer.security.web.dto.VerifySecurityAnswersRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/security")
@RequiredArgsConstructor
@Tag(name = "Security")
@SecurityRequirement(name = "bearerAuth")
public class SecurityController {

    private final PinService pinService;
    private final SecurityQuestionService securityQuestionService;
    private final DeviceService deviceService;

    // ---- PIN ----

    @GetMapping("/pin")
    @Operation(summary = "Get transaction PIN status")
    public ApiResponse<PinStatusResponse> pinStatus(@AuthenticationPrincipal UserPrincipal principal) {
        return ApiResponse.ok(pinService.status(principal.getId()));
    }

    @PostMapping("/pin")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Set transaction PIN")
    public ApiResponse<Void> setPin(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody SetPinRequest request) {
        pinService.setPin(principal.getId(), request);
        return ApiResponse.ok("PIN set", null);
    }

    @PutMapping("/pin")
    @Operation(summary = "Change transaction PIN")
    public ApiResponse<Void> changePin(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody ChangePinRequest request) {
        pinService.changePin(principal.getId(), request);
        return ApiResponse.ok("PIN changed", null);
    }

    @PostMapping("/pin/reset")
    @Operation(summary = "Reset transaction PIN using security questions")
    public ApiResponse<Void> resetPin(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody ResetPinRequest request) {
        pinService.resetPin(principal.getId(), request);
        return ApiResponse.ok("PIN reset", null);
    }

    @PostMapping("/pin/verify")
    @Operation(summary = "Verify transaction PIN")
    public ApiResponse<Void> verifyPin(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody VerifyPinRequest request) {
        pinService.verifyPin(principal.getId(), request);
        return ApiResponse.ok("PIN verified", null);
    }

    // ---- Security questions ----

    @PutMapping("/questions")
    @Operation(summary = "Set security questions")
    public ApiResponse<List<SecurityQuestionResponse>> setQuestions(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody SetSecurityQuestionsRequest request) {
        return ApiResponse.ok("Security questions saved", securityQuestionService.setQuestions(principal.getId(), request));
    }

    @GetMapping("/questions")
    @Operation(summary = "List security questions (no answers)")
    public ApiResponse<List<SecurityQuestionResponse>> listQuestions(
            @AuthenticationPrincipal UserPrincipal principal) {
        return ApiResponse.ok(securityQuestionService.listQuestions(principal.getId()));
    }

    @PostMapping("/questions/verify")
    @Operation(summary = "Verify security-question answers (PIN reset gate)")
    public ApiResponse<Void> verifyQuestions(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody VerifySecurityAnswersRequest request) {
        pinService.verifySecurityAnswers(principal.getId(), request.answers());
        return ApiResponse.ok("Security answers verified", null);
    }

    // ---- Biometric devices ----

    @PostMapping("/devices")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Register biometric device")
    public ApiResponse<DeviceResponse> registerDevice(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody RegisterDeviceRequest request) {
        return ApiResponse.ok("Device registered", deviceService.register(principal.getId(), request));
    }

    @GetMapping("/devices")
    @Operation(summary = "List registered devices")
    public ApiResponse<List<DeviceResponse>> listDevices(@AuthenticationPrincipal UserPrincipal principal) {
        return ApiResponse.ok(deviceService.list(principal.getId()));
    }

    @PostMapping("/devices/{deviceId}/disable")
    @Operation(summary = "Disable biometric device")
    public ApiResponse<DeviceResponse> disableDevice(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID deviceId) {
        return ApiResponse.ok(deviceService.disable(principal.getId(), deviceId));
    }

    @PostMapping("/devices/{deviceId}/enable")
    @Operation(summary = "Enable biometric device")
    public ApiResponse<DeviceResponse> enableDevice(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID deviceId) {
        return ApiResponse.ok(deviceService.enable(principal.getId(), deviceId));
    }

    @DeleteMapping("/devices/{deviceId}")
    @Operation(summary = "Delete biometric device")
    public ApiResponse<Void> deleteDevice(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID deviceId) {
        deviceService.delete(principal.getId(), deviceId);
        return ApiResponse.ok("Device deleted", null);
    }
}
