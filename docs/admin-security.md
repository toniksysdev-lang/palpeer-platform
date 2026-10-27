# Admin-End security review (Phase 14 / Gate 14)

**Date:** 2026-09-26  
**Scope:** `palpeer-admin-end/` frontend only  
**Gate criteria:** no critical security issues

## Summary

| Area | Verdict | Notes |
|------|---------|-------|
| Authentication | OK | JWT login + refresh; admin probe via `GET /admin/users` |
| Authorization | OK (UI soft) | `can()` is UX-only; backend RBAC remains authoritative. Fine-grained menu hide needs `/admin/me` (CONTRACT_PENDING) |
| Route guards | Hardened | `RequireAuth` requires `authenticated` **and** `isAdmin` |
| Open redirect | Hardened | Post-login `from` sanitized to `/admin/**` only |
| Token storage | Accepted residual | sessionStorage by default; localStorage only when “Remember session”. SPA cannot use httpOnly cookies without backend cookie auth |
| Token integrity | Hardened | Malformed JWT-shaped tokens are rejected/cleared |
| Sensitive data | OK | No PAN/CVV; cards use `lastFour` only; no `dangerouslySetInnerHTML` |
| Logging | OK | No token/password console logging |
| XSS | OK | React text escaping; audit before/after values rendered as text |
| CSRF | OK | Bearer tokens + `credentials: 'omit'` (no cookie session) |
| API path safety | Hardened | Relative `/…` paths only; absolute URLs rejected |
| Environment | Hardened | Prod forces mock off; non-loopback prod API/WS must be https/wss |
| Dependencies | OK | `npm audit` → 0 vulnerabilities (full + prod) |
| Headers | Hardened | Dev/preview + Render static: CSP, HSTS (prod/preview), nosniff, DENY frame, referrer, permissions-policy; HTML `noindex`. API adds HSTS in prod. |

## Critical issues

None.

## Hardening applied this phase

- `safeAdminRedirect` for sign-in return paths
- JWT shape validation on persist/load
- Fetch `credentials: 'omit'` + `cache: 'no-store'`
- Production HTTPS/WSS URL enforcement (loopback exception)
- Vite server/preview security headers
- `.env.development` / `.env.production` gitignored (use `.env.example`)
- Remember-session UX warning

## Residual risks (accepted / documented)

1. **XSS → token theft** if a future XSS lands while tokens live in web storage. Mitigations: CSP meta (build) + Render headers; no HTML injection APIs.
2. **Remember session** uses localStorage — operators should avoid on shared devices.
3. **Frontend permission checks are not authoritative**; backend RBAC + `ADMIN_MFA_REQUIRED` gate admin APIs.
4. **External Google Fonts** — CSP allowlists Google Fonts; self-hosting remains optional polish.
5. **Password reset** admin UX remains CONTRACT_PENDING.
6. **iOS TLS pinning** — Android SPKI pinning is in `withSslPinning`; iOS TrustKit/pinning is still optional follow-up.

## Hosting checklist (ops)

- Serve over HTTPS only (Render redirects HTTP → HTTPS)
- CSP + HSTS + frame/nosniff headers are set in `render.yaml` for `palpeer-admin`
- Optionally tighten CSP `connect-src` in the Render Dashboard to the exact API origin
- Do not commit real `.env.*` secrets (none required today beyond public Vite URLs)
