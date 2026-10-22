# Mail deliverability (SendPulse)

## Correct setup (current)

Use SendPulse account **`dev@palpeer.com` (ID 9533521)**:

| Item | Value |
|------|--------|
| From | `noreply@palpeer.com` (Active sender) |
| Authenticated domain | `palpeer.com` (Default — SPF+DKIM present in DNS) |
| API | Client credentials from **Settings → API and webhooks → Client credentials** |

```env
PALPEER_MAIL_FROM=noreply@palpeer.com
PALPEER_MAIL_FROM_NAME=Palpeer
PALPEER_MAIL_HEADER_FROM=support@palpeer.com
PALPEER_SENDPULSE_CLIENT_ID=…   # this account
PALPEER_SENDPULSE_CLIENT_SECRET=…
```

Do **not** use API keys from a different SendPulse account (e.g. one that only has `noreply@palpeer.com.ng`) — that account cannot send as `noreply@palpeer.com` and `.ng` fails DMARC.

## Why `.ng` mail lands in spam

If From is `noreply@palpeer.com.ng`:

| Check | `palpeer.com.ng` | Needed for SendPulse |
|-------|------------------|----------------------|
| SPF | `v=spf1 +a +mx include:_spf.truehostcloud.com ~all` | Must include `include:mxsspf.sendpulse.com` |
| DKIM | no `sign._domainkey` | SendPulse selector `sign._domainkey` |
| DMARC | `v=DMARC1; p=quarantine; adkim=s; aspf=s` | Passes only when SPF **and/or** DKIM **align** with From |

On account 9533521, `palpeer.com.ng` shows **Awaiting confirmation** until DNS is fixed. Prefer `palpeer.com` until then.

## Fix (Truehost DNS for `palpeer.com.ng`)

In Truehost / cPanel → Zone Editor for **`palpeer.com.ng`**, apply:

### 1. Ownership verification (required first)

SendPulse registered the domain on this API account; status is **pending ownership**.

| Type | Name | Value |
|------|------|--------|
| TXT | `@` (or `palpeer.com.ng`) | `sendpulse-domain-verification=c17069bb6fa05c0cc7623cd696750254` |

Keep this TXT; do not remove after verification.

### 2. SPF (merge into the existing SPF TXT — do **not** create a second SPF record)

Replace the current SPF value with:

```text
v=spf1 include:mxsspf.sendpulse.com +a +mx include:_spf.truehostcloud.com ~all
```

### 3. DKIM

| Type | Name | Value |
|------|------|--------|
| TXT | `sign._domainkey` | Copy from SendPulse → **SMTP → Settings → Domain settings → palpeer.com.ng → Show settings** (selector is always `sign`) |

### 4. Optional while testing

If you want fewer quarantines before DKIM propagates, temporarily relax alignment:

```text
v=DMARC1; p=none; adkim=r; aspf=r
```

Then restore `p=quarantine` (and strict/relaxed as preferred) once SendPulse shows SPF+DKIM green.

### 5. Confirm in SendPulse

SMTP → Domain settings → **Check DNS records** until status is **Connected** (`all_checks: true`).

Re-test with [mail-tester.com](https://www.mail-tester.com/) (new address each time). Target ≥ 8/10 with SPF/DKIM/DMARC pass.

## Yahoo / AOL still in spam?

Auth can be perfect (mail-tester 10/10) and Yahoo still filters:

1. **Cold / test content** — subjects like “test email” and tiny plain-text bodies look like probes. Use the real branded transactional template (OTP / welcome).
2. **Shared SendPulse IP** — free-plan IPs are shared; Yahoo reputation is IP+domain. Warming helps; paid dedicated IP is the long-term fix.
3. **Reply-To** — use a monitored address (`support@palpeer.com`), not `noreply@`.
4. **One-time training** — open the message → **Not spam**. That teaches Yahoo for that mailbox.

Yahoo accepted our test with `250 ok dirdel` (delivered, then filtered client-side).

## App-side hardening (all notification emails)

Every product email goes through `EmailSender` + `PalpeerEmailTemplates`:

| Path | Template |
|------|----------|
| OTP / email verify / password reset | `LoggingOtpSender` |
| Welcome | `AuthService` |
| New device login | `AuthService` |
| In-app notification email channel | `NotificationService` |
| Pool fund threshold alerts | `PoolFundThresholdService` |

Code guarantees:

- **From name** defaults to `Palpeer` (not ALL-CAPS).
- **Reply-To** always set to `PALPEER_MAIL_HEADER_FROM` / `support@palpeer.com` (never `noreply@`).
- **Subjects** use title case (`Verify your Palpeer email`), not shouty ALL-CAPS.
- **SendPulse** rewrites `cid:` logo → `https://palpeer.com/logo.png` (no huge data-URI; smaller MIME).
- **SMTP** still attaches the logo as inline CID and sets the same Reply-To.

## App config

```env
PALPEER_MAIL_PROVIDER=sendpulse
PALPEER_MAIL_FROM=noreply@palpeer.com
PALPEER_MAIL_FROM_NAME=Palpeer
PALPEER_MAIL_HEADER_FROM=support@palpeer.com
PALPEER_SENDPULSE_CLIENT_ID=…   # Settings → API → Client credentials
PALPEER_SENDPULSE_CLIENT_SECRET=…
```

Do not point `PALPEER_SENDPULSE_CLIENT_*` at SMTP mailbox passwords; those are not REST OAuth credentials.

## Verify via API

```bash
# After OAuth:
GET https://api.sendpulse.com/v2/email-service/smtp/sender_domains
```

Look for `service_value: palpeer.com.ng` with `checks.all_checks: true` and `pending_ownership` absent/false.
