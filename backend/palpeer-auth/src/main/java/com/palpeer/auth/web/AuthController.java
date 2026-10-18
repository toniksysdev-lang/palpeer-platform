package com.palpeer.auth.web;

import com.palpeer.auth.security.UserPrincipal;
import com.palpeer.auth.service.AuthService;
import com.palpeer.auth.web.dto.AuthTokensResponse;
import com.palpeer.auth.web.dto.ChangePasswordRequest;
import com.palpeer.auth.web.dto.GoogleAuthRequest;
import com.palpeer.auth.web.dto.LoginRequest;
import com.palpeer.auth.web.dto.LogoutRequest;
import com.palpeer.auth.web.dto.OtpResendRequest;
import com.palpeer.auth.web.dto.OtpResendResponse;
import com.palpeer.auth.web.dto.OtpVerifyRequest;
import com.palpeer.auth.web.dto.PasswordResetConfirmRequest;
import com.palpeer.auth.web.dto.PasswordResetRequestDto;
import com.palpeer.auth.web.dto.RefreshTokenRequest;
import com.palpeer.auth.web.dto.RegisterRequest;
import com.palpeer.auth.web.dto.RegisterResponse;
import com.palpeer.auth.web.dto.SessionResponse;
import com.palpeer.auth.web.dto.SuspendAccountRequest;
import com.palpeer.common.api.ApiResponse;
import com.palpeer.common.exception.BusinessException;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.util.HtmlUtils;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
@Tag(name = "Authentication")
public class AuthController {

    private final AuthService authService;

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Register a new user")
    public ApiResponse<RegisterResponse> register(@Valid @RequestBody RegisterRequest request) {
        return ApiResponse.ok("Registered", authService.register(request));
    }

    @PostMapping("/login")
    @Operation(summary = "Login with email or phone and password")
    public ApiResponse<AuthTokensResponse> login(@Valid @RequestBody LoginRequest request) {
        return ApiResponse.ok(authService.login(request));
    }

    @PostMapping("/google")
    @Operation(summary = "Sign in or sign up with a Google ID token")
    public ApiResponse<AuthTokensResponse> google(@Valid @RequestBody GoogleAuthRequest request) {
        return ApiResponse.ok(authService.loginWithGoogle(request.idToken(), request.device()));
    }

    @GetMapping(value = "/account-suspend", produces = MediaType.TEXT_HTML_VALUE)
    @Operation(summary = "HTML form for emergency account suspend (token from new-device email)")
    public ResponseEntity<String> suspendAccountForm(@RequestParam("token") String token) {
        return ResponseEntity.ok()
                .contentType(MediaType.TEXT_HTML)
                .body(authService.suspendAccountFormHtml(token));
    }

    @PostMapping(value = "/account-suspend", consumes = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Suspend account with email token + email/password/PIN")
    public ApiResponse<Void> suspendAccountJson(@Valid @RequestBody SuspendAccountRequest request) {
        authService.suspendAccount(request);
        return ApiResponse.ok("Account suspended", null);
    }

    @PostMapping(
            value = "/account-suspend",
            consumes = MediaType.APPLICATION_FORM_URLENCODED_VALUE,
            produces = MediaType.TEXT_HTML_VALUE)
    @Operation(summary = "Suspend account from the emailed HTML form")
    public ResponseEntity<String> suspendAccountFormSubmit(
            @RequestParam("token") String token,
            @RequestParam("email") String email,
            @RequestParam("password") String password,
            @RequestParam("pin") String pin) {
        try {
            authService.suspendAccount(new SuspendAccountRequest(token, email, password, pin));
            return ResponseEntity.ok()
                    .contentType(MediaType.TEXT_HTML)
                    .body(suspendResultHtml(
                            true,
                            "Account suspended",
                            "Your PALPEER account is suspended and all sessions were ended."
                                    + " Contact support if you need it reactivated."));
        } catch (BusinessException ex) {
            return ResponseEntity.status(ex.getStatus())
                    .contentType(MediaType.TEXT_HTML)
                    .body(suspendResultHtml(false, "Could not suspend", ex.getMessage()));
        }
    }

    private static String suspendResultHtml(boolean ok, String title, String message) {
        String color = ok ? "#3DD68C" : "#F5A623";
        return """
                <!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/>
                <meta name="viewport" content="width=device-width, initial-scale=1"/>
                <title>%s</title>
                <style>body{font-family:sans-serif;background:#0F1A14;color:#F4F6F4;padding:24px}
                .card{max-width:420px;margin:40px auto;background:#14201A;border:1px solid #24352C;
                border-radius:12px;padding:24px}h1{color:%s;font-size:1.2rem}</style></head>
                <body><div class="card"><h1>%s</h1><p>%s</p></div></body></html>
                """
                .formatted(
                        HtmlUtils.htmlEscape(title),
                        color,
                        HtmlUtils.htmlEscape(title),
                        HtmlUtils.htmlEscape(message));
    }

    @PostMapping("/logout")
    @Operation(summary = "Logout by revoking refresh token")
    public ApiResponse<Void> logout(@Valid @RequestBody LogoutRequest request) {
        authService.logout(request.refreshToken());
        return ApiResponse.ok("Logged out", null);
    }

    @PostMapping("/refresh")
    @Operation(summary = "Rotate refresh token and issue new access token")
    public ApiResponse<AuthTokensResponse> refresh(@Valid @RequestBody RefreshTokenRequest request) {
        return ApiResponse.ok(authService.refresh(request.refreshToken()));
    }

    @PostMapping("/otp/verify")
    @Operation(summary = "Verify OTP")
    public ApiResponse<Void> verifyOtp(@Valid @RequestBody OtpVerifyRequest request) {
        authService.verifyOtp(request);
        return ApiResponse.ok("OTP verified", null);
    }

    @PostMapping("/otp/resend")
    @Operation(summary = "Resend OTP")
    public ApiResponse<OtpResendResponse> resendOtp(@Valid @RequestBody OtpResendRequest request) {
        return ApiResponse.ok("OTP resent", authService.resendOtp(request));
    }

    @PostMapping("/password-reset/request")
    @Operation(summary = "Request password reset OTP")
    public ApiResponse<Void> requestPasswordReset(@Valid @RequestBody PasswordResetRequestDto request) {
        authService.requestPasswordReset(request);
        return ApiResponse.ok("If the account exists, a reset OTP has been sent", null);
    }

    @PostMapping("/password-reset/confirm")
    @Operation(summary = "Confirm password reset with OTP")
    public ApiResponse<Void> confirmPasswordReset(@Valid @RequestBody PasswordResetConfirmRequest request) {
        authService.confirmPasswordReset(request);
        return ApiResponse.ok("Password reset successful", null);
    }

    @PostMapping("/password/change")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "Change own password (revokes all refresh tokens)")
    public ApiResponse<Void> changePassword(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody ChangePasswordRequest request) {
        authService.changePassword(principal.getId(), request);
        return ApiResponse.ok("Password changed", null);
    }

    @GetMapping("/sessions")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "List own active refresh-token sessions")
    public ApiResponse<List<SessionResponse>> sessions(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestHeader(name = "X-Refresh-Token", required = false) String refreshToken) {
        return ApiResponse.ok(authService.listSessions(principal.getId(), refreshToken));
    }

    @PostMapping("/sessions/{id}/revoke")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "Revoke one of own sessions")
    public ApiResponse<Void> revokeSession(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID id) {
        authService.revokeSession(principal.getId(), id);
        return ApiResponse.ok("Session revoked", null);
    }

    @PostMapping("/sessions/revoke-all")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "Revoke all own sessions")
    public ApiResponse<Void> revokeAllSessions(@AuthenticationPrincipal UserPrincipal principal) {
        authService.revokeAllSessions(principal.getId());
        return ApiResponse.ok("All sessions revoked", null);
    }
}
