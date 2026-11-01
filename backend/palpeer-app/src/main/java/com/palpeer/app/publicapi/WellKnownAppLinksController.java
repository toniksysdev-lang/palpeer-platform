package com.palpeer.app.publicapi;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * App Links / Universal Links association files for the API host used by P2P share URLs.
 *
 * <p>Share messages open {@code https://&lt;api-host&gt;/p2p/share/{id}} (see
 * {@link P2PShareOpenController}). Serving these files lets Android/iOS hand the HTTPS link
 * straight to the installed Palpeer app when verification succeeds; the HTML bridge remains
 * the fallback when chat apps open the link in an in-app browser.
 */
@RestController
public class WellKnownAppLinksController {

    private static final String ANDROID_PACKAGE = "com.palpeer.app";
    private static final String IOS_APP_ID = "GXZ92PPYUW.com.palpeer.app";

    /**
     * Android Digital Asset Links. Fingerprints can be filled later from Play App Signing;
     * the HTML bridge still opens the app via {@code intent://} / {@code palpeer://}.
     */
    @GetMapping(value = "/.well-known/assetlinks.json", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<String> assetLinks() {
        String body =
                """
                [{
                  "relation": ["delegate_permission/common.handle_all_urls"],
                  "target": {
                    "namespace": "android_app",
                    "package_name": "%s",
                    "sha256_cert_fingerprints": []
                  }
                }]
                """
                        .formatted(ANDROID_PACKAGE);
        return ResponseEntity.ok()
                .header("Content-Type", "application/json")
                .header("Cache-Control", "public, max-age=3600")
                .body(body);
    }

    @GetMapping(value = "/.well-known/apple-app-site-association")
    public ResponseEntity<String> appleAppSiteAssociation() {
        String body =
                """
                {
                  "applinks": {
                    "apps": [],
                    "details": [{
                      "appID": "%s",
                      "paths": ["/p2p/share/*"]
                    }]
                  }
                }
                """
                        .formatted(IOS_APP_ID);
        // Apple rejects charset on this Content-Type.
        return ResponseEntity.ok()
                .header("Content-Type", "application/json")
                .header("Cache-Control", "public, max-age=3600")
                .body(body);
    }
}
