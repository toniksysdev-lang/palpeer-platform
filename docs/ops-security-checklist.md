# Ops security checklist (host / env)

Apply + audit with:

```bash
node scripts/apply-ops-security.mjs          # env + SSL pins (no deploy)
node scripts/apply-ops-security.mjs --deploy # also trigger palpeer-api deploy
```

## Render API (`palpeer-api`)

- [x] `OTP_LOG_CODE=false` (script + Blueprint)
- [x] `ADMIN_MFA_REQUIRED=true` (script + Blueprint)
- [ ] Webhook secrets set (script audits SET/MISSING): `APAYLO_WEBHOOK_SECRET`, `KUDA_WEBHOOK_SECRET` or `KUDA_WEBHOOK_USERNAME`+`PASSWORD`, `KORAPAY_WEBHOOK_SECRET`, `COMPLYCUBE_WEBHOOK_SECRET`
- [ ] Redis env present (`REDIS_HOST` / `PORT` / `PASSWORD` / `REDIS_SSL`) — usually from Blueprint
- [ ] Deploy after env change (`--deploy` or Dashboard → Manual Deploy)

## Render admin (`palpeer-admin`)

- [x] Blueprint headers include CSP + HSTS (`render.yaml`)
- [ ] Optional: tighten Dashboard CSP `connect-src` to the exact API origin (build meta CSP already scopes to `VITE_API_BASE_URL`)

## Mobile release builds

- [x] `EXPO_PUBLIC_API_SSL_PINS` written into `eas.json` preview/production by `apply-ops-security.mjs`
- [x] Android `network_security_config` + iOS TrustKit via `plugins/withSslPinning.js`
- [ ] Re-run the script after TLS certificate rotation; pin `expiration` is 2028-12-31

## After MFA enroll

- [ ] Store recovery codes offline (shown once)
