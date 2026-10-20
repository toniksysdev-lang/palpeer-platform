package com.palpeer.auth.web;

import com.palpeer.auth.service.AuthService;
import com.palpeer.auth.web.dto.SuspendAccountRequest;
import com.palpeer.common.exception.BusinessException;
import io.swagger.v3.oas.annotations.Hidden;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.util.HtmlUtils;

/**
 * Browser-only emergency account lock page (emailed after a new-device sign-in).
 *
 * <p>Intentionally outside {@code /api/v1/**}: the link is not an API surface. Opening the URL
 * only renders a confirmation form; suspending still requires email, password, and PIN. The
 * lock key alone cannot authenticate or mutate state.
 */
@RestController
@RequestMapping("/secure/account-lock")
@RequiredArgsConstructor
@Hidden
public class SecureAccountLockController {

    private final AuthService authService;

    @GetMapping(value = "/{lockKey}", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> lockForm(@PathVariable("lockKey") String lockKey) {
        return secureHtml(authService.suspendAccountFormHtml(lockKey));
    }

    @PostMapping(
            value = "/{lockKey}",
            consumes = MediaType.APPLICATION_FORM_URLENCODED_VALUE,
            produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> lockSubmit(
            @PathVariable("lockKey") String lockKey,
            @RequestParam("email") String email,
            @RequestParam("password") String password,
            @RequestParam("pin") String pin) {
        try {
            authService.suspendAccount(new SuspendAccountRequest(lockKey, email, password, pin));
            return secureHtml(resultHtml(
                    true,
                    "Account suspended",
                    "Your PALPEER account is suspended and all sessions were ended."
                            + " Contact support if you need it reactivated."));
        } catch (BusinessException ex) {
            return ResponseEntity.status(ex.getStatus())
                    .headers(secureHeaders())
                    .contentType(MediaType.TEXT_HTML)
                    .body(resultHtml(false, "Could not suspend", ex.getMessage()));
        }
    }

    private static ResponseEntity<String> secureHtml(String body) {
        return ResponseEntity.ok()
                .headers(secureHeaders())
                .contentType(MediaType.TEXT_HTML)
                .body(body);
    }

    private static HttpHeaders secureHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.set(HttpHeaders.CACHE_CONTROL, "no-store, no-cache, must-revalidate, private");
        headers.set(HttpHeaders.PRAGMA, "no-cache");
        headers.set("Referrer-Policy", "no-referrer");
        headers.set("X-Content-Type-Options", "nosniff");
        headers.set("X-Frame-Options", "DENY");
        headers.set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'");
        return headers;
    }

    private static String resultHtml(boolean ok, String title, String message) {
        String color = ok ? "#3DD68C" : "#F5A623";
        return """
                <!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/>
                <meta name="viewport" content="width=device-width, initial-scale=1"/>
                <meta name="referrer" content="no-referrer"/>
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
}
