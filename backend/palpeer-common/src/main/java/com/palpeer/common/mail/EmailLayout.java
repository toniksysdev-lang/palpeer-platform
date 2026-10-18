package com.palpeer.common.mail;

/**
 * Shared HTML shell for Palpeer transactional emails — dark, sleek, table-based for client safety.
 */
public final class EmailLayout {

    private EmailLayout() {}

    public static String wrap(String preheader, String title, String innerHtml) {
        String safePreheader = escape(preheader == null ? "" : preheader);
        String safeTitle = escape(title == null ? "PALPEER" : title);

        return """
                <!DOCTYPE html>
                <html lang="en">
                <head>
                  <meta charset="utf-8"/>
                  <meta name="viewport" content="width=device-width, initial-scale=1"/>
                  <meta name="color-scheme" content="dark"/>
                  <meta name="supported-color-schemes" content="dark"/>
                  <title>%s</title>
                  <!--[if mso]><style>table,td{font-family:Arial,sans-serif!important}</style><![endif]-->
                </head>
                <body style="margin:0;padding:0;background-color:%s;color:%s;font-family:%s;-webkit-font-smoothing:antialiased;">
                  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all;">
                    %s
                  </div>
                  <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" border="0" style="background-color:%s;width:100%%;">
                    <tr>
                      <td align="center" style="padding:32px 16px;">
                        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%%;max-width:560px;background-color:%s;border:1px solid %s;border-radius:16px;overflow:hidden;">
                          <tr>
                            <td style="height:4px;line-height:4px;font-size:0;background-color:%s;">&nbsp;</td>
                          </tr>
                          <tr>
                            <td style="padding:24px 28px 16px 28px;border-bottom:1px solid %s;">
                              <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" border="0">
                                <tr>
                                  <td valign="middle" style="line-height:0;">
                                    <a href="%s" style="text-decoration:none;border:0;outline:none;">
                                      <img src="%s" width="%d" alt="PALPEER" style="display:block;border:0;outline:none;text-decoration:none;height:auto;max-width:100%%;width:%dpx;"/>
                                    </a>
                                  </td>
                                  <td align="right" valign="middle" style="font-size:11px;color:%s;letter-spacing:0.08em;text-transform:uppercase;padding-left:12px;">
                                    %s
                                  </td>
                                </tr>
                              </table>
                            </td>
                          </tr>
                          <tr>
                            <td style="padding:32px 28px 8px 28px;">
                              %s
                            </td>
                          </tr>
                          <tr>
                            <td style="padding:24px 28px 28px 28px;border-top:1px solid %s;">
                              <p style="margin:0 0 8px 0;font-size:12px;line-height:1.5;color:%s;">
                                Need help? <a href="mailto:%s" style="color:%s;text-decoration:none;">%s</a>
                              </p>
                              <p style="margin:0;font-size:12px;line-height:1.5;color:%s;">
                                © PALPEER · <a href="%s" style="color:%s;text-decoration:none;">palpeer.com</a>
                                · FINTRAC MSB #C100000342
                              </p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </body>
                </html>
                """
                .formatted(
                        safeTitle,
                        EmailBrand.BG,
                        EmailBrand.TEXT,
                        EmailBrand.FONT,
                        safePreheader,
                        EmailBrand.BG,
                        EmailBrand.CARD,
                        EmailBrand.BORDER,
                        EmailBrand.PRIMARY,
                        EmailBrand.BORDER,
                        escapeAttr(EmailBrand.SITE_URL),
                        escapeAttr(EmailBrand.LOGO_CID_SRC),
                        EmailBrand.LOGO_WIDTH_PX,
                        EmailBrand.LOGO_WIDTH_PX,
                        EmailBrand.TEXT_DIM,
                        EmailBrand.TAGLINE,
                        innerHtml,
                        EmailBrand.BORDER,
                        EmailBrand.TEXT_DIM,
                        EmailBrand.SUPPORT_EMAIL,
                        EmailBrand.LINK,
                        EmailBrand.SUPPORT_EMAIL,
                        EmailBrand.TEXT_DIM,
                        EmailBrand.SITE_URL,
                        EmailBrand.LINK);
    }

    public static String heading(String text) {
        return "<h1 style=\"margin:0 0 12px 0;font-size:24px;line-height:1.25;font-weight:700;letter-spacing:-0.3px;color:"
                + EmailBrand.TEXT
                + ";\">"
                + escape(text)
                + "</h1>";
    }

    public static String paragraph(String text) {
        return "<p style=\"margin:0 0 16px 0;font-size:15px;line-height:1.6;color:"
                + EmailBrand.TEXT_MUTED
                + ";\">"
                + escape(text)
                + "</p>";
    }

    public static String paragraphHtml(String trustedHtml) {
        return "<p style=\"margin:0 0 16px 0;font-size:15px;line-height:1.6;color:"
                + EmailBrand.TEXT_MUTED
                + ";\">"
                + trustedHtml
                + "</p>";
    }

    public static String primaryButton(String label, String href) {
        return """
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 8px 0;">
                  <tr>
                    <td align="center" bgcolor="%s" style="border-radius:999px;background-color:%s;">
                      <a href="%s" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:%s;text-decoration:none;border-radius:999px;font-family:%s;">
                        %s
                      </a>
                    </td>
                  </tr>
                </table>
                """
                .formatted(
                        EmailBrand.PRIMARY,
                        EmailBrand.PRIMARY,
                        escapeAttr(href),
                        EmailBrand.ON_PRIMARY,
                        EmailBrand.FONT,
                        escape(label));
    }

    public static String otpCodeBox(String code) {
        return """
                <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 24px 0;">
                  <tr>
                    <td align="center" style="background-color:%s;border:1px solid %s;border-radius:14px;padding:22px 16px;">
                      <div style="font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:%s;margin-bottom:10px;font-weight:600;">
                        Verification code
                      </div>
                      <div style="font-size:32px;line-height:1.2;font-weight:700;letter-spacing:0.28em;color:%s;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;">
                        %s
                      </div>
                    </td>
                  </tr>
                </table>
                """
                .formatted(
                        EmailBrand.PRIMARY_SOFT,
                        EmailBrand.PRIMARY,
                        EmailBrand.TEXT_MUTED,
                        EmailBrand.PRIMARY,
                        escape(code));
    }

    public static String mutedNote(String text) {
        return "<p style=\"margin:8px 0 0 0;font-size:13px;line-height:1.5;color:"
                + EmailBrand.TEXT_DIM
                + ";\">"
                + escape(text)
                + "</p>";
    }

    public static String escape(String value) {
        if (value == null) {
            return "";
        }
        return value
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;");
    }

    private static String escapeAttr(String value) {
        return escape(value).replace("'", "&#39;");
    }
}
