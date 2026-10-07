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
| Headers | Hardened | Dev/preview: nosniff, DENY frame, referrer, permissions-policy; HTML `noindex` |

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

1. **XSS → token theft** if a future XSS lands while tokens live in web storage. Mitigations: no HTML injection APIs; CSP at CDN/host still recommended.
2. **Remember session** uses localStorage — operators should avoid on shared devices.
3. **Frontend permission checks are not authoritative** until `/admin/me` exists; live mode treats `ROLE_ADMIN` as UI-visible and relies on API 403s.
4. **External Google Fonts** — host should add CSP `style-src`/`font-src` allowlists; self-hosting fonts is a Phase 15+ polish option.
5. **Password reset** admin UX remains CONTRACT_PENDING.

## Hosting checklist (ops)

- Serve over HTTPS only
- Set CSP (include API origin in `connect-src`)
- `X-Frame-Options: DENY` / `frame-ancestors 'none'`
- Do not commit real `.env.*` secrets (none required today beyond public Vite URLs)
