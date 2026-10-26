package com.palpeer.app.publicapi;

import com.palpeer.common.mail.EmailBrand;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * HTTPS bridge for email “Open Palpeer App” CTAs. Mail clients (Gmail, Outlook, Yahoo) strip or
 * disable custom schemes like {@code palpeer://}, so the button must use {@code https://}. This
 * page then hands off to the installed app on iOS and Android via the registered URL scheme /
 * Android intent, with store fallbacks when the app is missing.
 */
@RestController
public class OpenAppController {

    private static final String ANDROID_PACKAGE = "com.palpeer.app";
    private static final String PLAY_STORE =
            "https://play.google.com/store/apps/details?id=" + ANDROID_PACKAGE;
    /** Legacy App Store listing; replace when the new ASC app is live. */
    private static final String APP_STORE = "https://apps.apple.com/app/id6753612161";
    private static final String SCHEME_OPEN = EmailBrand.APP_SCHEME_OPEN_URL;

    @GetMapping(value = "/open", produces = MediaType.TEXT_HTML_VALUE)
    public String openApp() {
        String intent =
                "intent://open#Intent;scheme=palpeer;package="
                        + ANDROID_PACKAGE
                        + ";S.browser_fallback_url="
                        + java.net.URLEncoder.encode(PLAY_STORE, java.nio.charset.StandardCharsets.UTF_8)
                        + ";end";
        return """
                <!DOCTYPE html>
                <html lang="en">
                <head>
                  <meta charset="utf-8"/>
                  <meta name="viewport" content="width=device-width, initial-scale=1"/>
                  <meta name="robots" content="noindex"/>
                  <title>Open Palpeer App</title>
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
                      var play = %s;
                      var appStore = %s;
                      var ua = navigator.userAgent || '';
                      var isAndroid = /Android/i.test(ua);
                      var isIOS = /iPhone|iPad|iPod/i.test(ua);
                      var target = isAndroid ? androidIntent : scheme;
                      var fallback = isIOS ? appStore : play;
                      try { window.location.href = target; } catch (e) {}
                      setTimeout(function () {
                        var el = document.getElementById('fallback');
                        if (el) el.style.display = 'block';
                      }, 1200);
                      setTimeout(function () {
                        if (document.hidden) return;
                        // Stay on this page with store buttons; do not auto-bounce to store
                        // (user may have dismissed the app open prompt).
                      }, 2500);
                      window.__palpeerFallback = fallback;
                    })();
                  </script>
                </head>
                <body>
                  <div class="card">
                    <h1>Opening Palpeer…</h1>
                    <p>If the app does not open automatically, tap below.</p>
                    <p>
                      <a class="btn" href="%s">Open Palpeer App</a>
                    </p>
                    <div id="fallback" style="display:none">
                      <a class="btn secondary" href="%s">Get it on Google Play</a>
                      <a class="btn secondary" href="%s">Download on the App Store</a>
                      <p style="margin-top:16px;font-size:13px">Or open <a href="%s" style="color:%s">%s</a></p>
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
                        jsonString(SCHEME_OPEN),
                        jsonString(intent),
                        jsonString(PLAY_STORE),
                        jsonString(APP_STORE),
                        escapeAttr(SCHEME_OPEN),
                        escapeAttr(PLAY_STORE),
                        escapeAttr(APP_STORE),
                        escapeAttr(SCHEME_OPEN),
                        EmailBrand.LINK,
                        escape(SCHEME_OPEN));
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
