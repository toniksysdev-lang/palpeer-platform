package com.palpeer.app.publicapi;

import com.palpeer.common.mail.EmailBrand;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import java.util.regex.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

/**
 * HTTPS bridge for shared P2P sell links. Chat apps often open {@code https://} URLs in a browser
 * instead of App Links; this page hands off to {@code palpeer://p2p/share/{id}} so the installed
 * app opens the shared request (with store fallbacks when missing).
 */
@RestController
public class P2PShareOpenController {

    private static final String ANDROID_PACKAGE = "com.palpeer.app";
    private static final String PLAY_STORE =
            "https://play.google.com/store/apps/details?id=" + ANDROID_PACKAGE;
    private static final String APP_STORE = "https://apps.apple.com/app/id6753612161";
    private static final Pattern UUID_PATTERN = Pattern.compile(
            "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$");

    @GetMapping(value = "/p2p/share/{requestId}", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> openShare(@PathVariable String requestId) {
        if (!UUID_PATTERN.matcher(requestId).matches()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .contentType(MediaType.TEXT_HTML)
                    .body("<!DOCTYPE html><html><body><p>Not found</p></body></html>");
        }
        // Validate format only — request may be expired/private; the app loads it.
        UUID.fromString(requestId);

        String path = "p2p/share/" + requestId;
        String scheme = "palpeer://" + path;
        String intent = "intent://"
                + path
                + "#Intent;scheme=palpeer;package="
                + ANDROID_PACKAGE
                + ";S.browser_fallback_url="
                + URLEncoder.encode(PLAY_STORE, StandardCharsets.UTF_8)
                + ";end";

        String html =
                """
                <!DOCTYPE html>
                <html lang="en">
                <head>
                  <meta charset="utf-8"/>
                  <meta name="viewport" content="width=device-width, initial-scale=1"/>
                  <meta name="robots" content="noindex"/>
                  <title>Open sell order · Palpeer</title>
                  <style>
                    body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
                      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
                      background:%s;color:%s;text-align:center;padding:24px}
                    .card{max-width:360px}
                    h1{font-size:22px;margin:0 0 8px;font-weight:700}
                    p{margin:0 0 20px;color:%s;font-size:15px;line-height:1.5}
                    a.btn{display:inline-block;padding:14px 28px;border-radius:999px;background:%s;color:%s;
                      font-weight:700;text-decoration:none;font-size:15px;margin:6px}
                    a.secondary{background:transparent;color:%s;border:1px solid %s}
                  </style>
                  <script>
                    (function () {
                      var scheme = %s;
                      var androidIntent = %s;
                      var ua = navigator.userAgent || '';
                      var isAndroid = /Android/i.test(ua);
                      var target = isAndroid ? androidIntent : scheme;
                      try { window.location.href = target; } catch (e) {}
                      setTimeout(function () {
                        var el = document.getElementById('fallback');
                        if (el) el.style.display = 'block';
                      }, 1200);
                    })();
                  </script>
                </head>
                <body>
                  <div class="card">
                    <h1>Opening Palpeer…</h1>
                    <p>If the app does not open automatically, tap below.</p>
                    <p>
                      <a class="btn" href="%s">Open sell order</a>
                    </p>
                    <div id="fallback" style="display:none">
                      <a class="btn secondary" href="%s">Get it on Google Play</a>
                      <a class="btn secondary" href="%s">Download on the App Store</a>
                    </div>
                  </div>
                </body>
                </html>
                """
                        .formatted(
                                EmailBrand.BG,
                                EmailBrand.TEXT,
                                EmailBrand.TEXT_MUTED,
                                EmailBrand.PRIMARY,
                                EmailBrand.ON_PRIMARY,
                                EmailBrand.PRIMARY,
                                EmailBrand.BORDER,
                                jsonString(scheme),
                                jsonString(intent),
                                escapeAttr(scheme),
                                escapeAttr(PLAY_STORE),
                                escapeAttr(APP_STORE));

        return ResponseEntity.ok().contentType(MediaType.TEXT_HTML).body(html);
    }

    private static String jsonString(String value) {
        return "\""
                + value.replace("\\", "\\\\").replace("\"", "\\\"").replace("/", "\\/")
                + "\"";
    }

    private static String escape(String value) {
        return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }

    private static String escapeAttr(String value) {
        return escape(value).replace("\"", "&quot;");
    }
}
