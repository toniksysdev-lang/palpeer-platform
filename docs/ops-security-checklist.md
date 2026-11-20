# Ops security checklist (host / env)

Apply + audit with:

```bash
node scripts/apply-ops-security.mjs          # env + SSL pins + domains (no deploy)
node scripts/apply-ops-security.mjs --deploy # also trigger palpeer-api deploy
node scripts/apply-ops-security.mjs --admin-ip=x.x.x.x --deploy
```

## Render API (`palpeer-api`)

- [x] `OTP_LOG_CODE=false` (script + Blueprint)
- [x] `ADMIN_MFA_REQUIRED=true` (script + Blueprint)
- [ ] `ADMIN_IP_ALLOWLIST` only when intentional (`--admin-ip=` or env); empty = open admin API (pair with Cloudflare Access)
- [x] `PUBLIC_API_BASE_URL` + `CORS_ALLOWED_ORIGINS` include onrender + `admin.palpeer.com`
- [x] Webhook secrets: script syncs from `.env` or generates `APAYLO_WEBHOOK_SECRET` / `KORAPAY_WEBHOOK_SECRET`; audits SET/MISSING
- [x] Redis env present (`REDIS_HOST` / `PORT` / `PASSWORD` / `REDIS_SSL`) — Blueprint
- [ ] Deploy after env change (`--deploy` or Dashboard → Manual Deploy)
- [ ] Paste generated Apaylo/Korapay webhook secrets into the provider dashboards (same value as Render)

## Custom domain (`api.palpeer.com`)

- [x] Script registers Render custom domains `api.palpeer.com` / `admin.palpeer.com`
- [ ] Truehost CNAME: `api` → `palpeer-api.onrender.com`, `admin` → `palpeer-admin.onrender.com`
- [ ] Certs issued; `https://api.palpeer.com/actuator/health` returns UP
- [ ] Then flip EAS `EXPO_PUBLIC_*` URLs + re-run pin extract against `api.palpeer.com`

## Render admin (`palpeer-admin`)

- [x] Blueprint headers include CSP + HSTS (`render.yaml`)
- [x] CSP `connect-src` limited to onrender + `api.palpeer.com` (not open `https:`/`wss:`)

## Mobile release builds

- [x] `EXPO_PUBLIC_API_SSL_PINS` written into `eas.json` preview/production by `apply-ops-security.mjs`
- [x] Android `network_security_config` + iOS TrustKit via `plugins/withSslPinning.js`
- [x] App Links hosts include `api.palpeer.com` + onrender (`app.config.ts` / deepLinks)
- [ ] Re-run the script after TLS certificate rotation / custom-domain cutover

## Edge WAF (Cloudflare)

Requires moving `palpeer.com` nameservers to Cloudflare — see [`edge-hardening.md`](edge-hardening.md) Phase C.
App-layer controls (auth rate limits, admin IP allowlist, webhook HMAC, HSTS) apply without Cloudflare.

## After MFA enroll

- [ ] Store recovery codes offline (shown once)
