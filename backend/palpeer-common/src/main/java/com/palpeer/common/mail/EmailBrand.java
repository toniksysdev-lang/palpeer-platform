package com.palpeer.common.mail;

/**
 * Brand tokens aligned with <a href="https://palpeer.com">palpeer.com</a>
 * (HSL primary 142 72% 55%, background 150 25% 8%).
 */
public final class EmailBrand {

    private EmailBrand() {}

    /** Page / outer canvas — site dark green-black. */
    public static final String BG = "#0F1A14";
    /** Card surface. */
    public static final String CARD = "#14201A";
    /** Subtle raised surface inside cards. */
    public static final String SURFACE = "#1A2921";
    /** Borders. */
    public static final String BORDER = "#24352C";
    /** Primary CTA — mint / neon green from the marketing site. */
    public static final String PRIMARY = "#3DD68C";
    /** Soft primary wash behind OTP digits. */
    public static final String PRIMARY_SOFT = "#1A3D2C";
    /** Text on primary buttons. */
    public static final String ON_PRIMARY = "#0F1A14";
    /** Headings / strong text. */
    public static final String TEXT = "#F4F6F4";
    /** Body copy. */
    public static final String TEXT_MUTED = "#A8B5AE";
    /** Footer / meta. */
    public static final String TEXT_DIM = "#6E7C74";
    /** Support / legal links. */
    public static final String LINK = "#3DD68C";

    public static final String FONT =
            "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
    /** Marketing website (footer / logo href). */
    public static final String SITE_URL = "https://palpeer.com";
    /**
     * HTTPS bridge that opens the installed Palpeer app (iOS + Android). Mail clients strip
     * custom schemes ({@code palpeer://}), so CTAs must use {@code https://}. Served by
     * {@code OpenAppController} at {@code GET /open}, which hands off to the app scheme.
     */
    public static final String APP_OPEN_URL = "https://palpeer-api.onrender.com/open";
    /** Primary CTA label for “open the app” buttons in transactional mail. */
    public static final String APP_OPEN_CTA = "Open Palpeer App";
    /** Native URL scheme used by the /open bridge page (not for email hrefs). */
    public static final String APP_SCHEME_OPEN_URL = "palpeer://open";
    /** Admin console sign-in (invite emails). */
    public static final String ADMIN_CONSOLE_URL = "https://palpeer-admin.onrender.com/sign-in";
    public static final String ADMIN_CONSOLE_CTA = "Open admin console";
    public static final String SUPPORT_EMAIL = "support@palpeer.com";
    public static final String TAGLINE = "Your Rate, Your Way";

    /**
     * Public logo for HTML mail (SendPulse REST cannot attach CID inlines). Prefer this over a
     * huge data-URI embed — smaller messages score better with Yahoo/Gmail spam filters.
     */
    public static final String LOGO_HTTPS_URL = SITE_URL + "/logo.png";

    /**
     * Content-ID for the inline logo attached by {@code SmtpEmailSender}
     * ({@code classpath:mail/palpeer-logo.png}). Templates reference {@code cid:palpeer-logo}.
     */
    public static final String LOGO_CONTENT_ID = "palpeer-logo";

    public static final String LOGO_CID_SRC = "cid:" + LOGO_CONTENT_ID;

    /** Display width (px) for the header logo in HTML clients. */
    public static final int LOGO_WIDTH_PX = 148;
}
