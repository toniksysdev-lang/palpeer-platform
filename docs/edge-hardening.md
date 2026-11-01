# Edge hardening: custom domains, WAF, admin IP allowlist, Access SSO

Target hostnames (recommended):

| Role | Hostname | Points at |
|------|----------|-----------|
| API | `api.palpeer.com` | `palpeer-api.onrender.com` |
| Admin | `admin.palpeer.com` | `palpeer-admin.onrender.com` |

Today `palpeer.com` DNS is on **Truehost / Cloudoon** (`ns1.cloudoon.com`, …), not Cloudflare. WAF + Access need either Cloudflare nameservers or a later DNS move. You can still add CNAMEs at Truehost and use the **app-layer** admin IP allowlist immediately.

## Phase A — Custom domains (Truehost + Render)

### 1. Add domains in Render

1. [palpeer-api](https://dashboard.render.com/web/srv-db3ca6tg1s2s739rpof0) → **Settings** → **Custom Domains** → `api.palpeer.com`
2. [palpeer-admin](https://dashboard.render.com/static/srv-db3b9o3ncjis73f2dkmg) → **Settings** → **Custom Domains** → `admin.palpeer.com`
3. Copy any verification CNAME Render shows (if required).

### 2. DNS at Truehost / Cloudoon

In the `palpeer.com` DNS zone, add:

| Type | Name | Target | Proxy |
|------|------|--------|-------|
| CNAME | `api` | `palpeer-api.onrender.com` | off / DNS only |
| CNAME | `admin` | `palpeer-admin.onrender.com` | off / DNS only |

Wait for Render certificates to become **Verified / Certificate issued**.

### 3. App config after DNS is live

On **palpeer-api** (Render env):

- `CORS_ALLOWED_ORIGINS` = `https://admin.palpeer.com,http://localhost:5173`
- `PUBLIC_API_BASE_URL` = `https://api.palpeer.com`
- Optional: `ADMIN_IP_ALLOWLIST` = your office/home IPv4 (comma-separated, CIDR ok)

Mobile (`palpeer-mobile/eas.json` preview + production):

- `EXPO_PUBLIC_API_BASE_URL` = `https://api.palpeer.com/api/v1`
- `EXPO_PUBLIC_WS_URL` = `https://api.palpeer.com/ws`
- `EXPO_PUBLIC_SHARE_BASE_URL` = `https://api.palpeer.com`
- Recompute `EXPO_PUBLIC_API_SSL_PINS` for the new cert chain after cutover
- Rebuild APK / iOS

Also update `app.config.ts` associatedDomains / intentFilters to include `api.palpeer.com`.

**Do not** flip EAS URLs until `https://api.palpeer.com/actuator/health` returns UP.

## Phase B — Admin API IP allowlist (already in code)

Env var: `ADMIN_IP_ALLOWLIST`

- Empty → no IP gate (current default)
- Example: `203.0.113.10,198.51.100.0/24`
- Enforced only on `/api/v1/admin/**` (403 `ADMIN_IP_DENIED`)
- Does **not** hide the admin SPA HTML; it blocks admin API calls from other networks

Find your public IPv4: open `https://api.ipify.org` from the network staff use, then set the Render env and redeploy API.

## Phase C — Cloudflare WAF + Access (SSO)

Requires moving `palpeer.com` nameservers to Cloudflare (or a Cloudflare zone that is authoritative).

1. Create a Cloudflare account → **Add site** → `palpeer.com` → copy CF nameservers.
2. At the registrar / Truehost, replace Cloudoon NS with Cloudflare NS. Keep existing mail/SPF/DKIM records when importing.
3. DNS (proxied orange cloud for edge protection):

| Type | Name | Target |
|------|------|--------|
| CNAME | `api` | `palpeer-api.onrender.com` |
| CNAME | `admin` | `palpeer-admin.onrender.com` |

SSL/TLS mode: **Full**.

4. **WAF (api + admin)**
   - Enable managed Free/Pro ruleset
   - Rate-limit rules on `api.palpeer.com`:
     - `POST /api/v1/auth/login`
     - `POST /api/v1/auth/otp/*`
     - `POST /api/v1/auth/password-reset/*`
   - Optional: challenge bots on `admin.palpeer.com`

5. **Cloudflare Access (admin SSO) — recommended over IP-only for the SPA**
   - Zero Trust → Access → Applications → Self-hosted
   - Application domain: `admin.palpeer.com`
   - Policy: allow emails `@palpeer.com` (or a Google Workspace / Microsoft IdP group)
   - Optional: require IdP MFA
   - Result: staff must pass Access **before** the Vite admin app loads; keep existing admin password + TOTP

6. Do **not** put Access in front of `api.palpeer.com` (mobile clients cannot complete the SSO dance).

## Phase D — What not to do on Free Render

- Render **Inbound IP Rules** for web/static need Scale/Enterprise — use Cloudflare or `ADMIN_IP_ALLOWLIST` instead.
- Render **private services** cannot host a browser admin SPA for staff on the public internet; use Access or VPN/tunnel if you need full network isolation.

## Checklist

- [ ] Render custom domains added
- [ ] Truehost CNAMEs for `api` / `admin`
- [ ] Certs issued; health OK on custom API host
- [ ] CORS + `PUBLIC_API_BASE_URL` updated; API redeployed
- [ ] `ADMIN_IP_ALLOWLIST` set (optional)
- [ ] EAS URLs + SSL pins updated; APK/iOS rebuilt
- [ ] (Later) Cloudflare NS + WAF + Access on `admin.palpeer.com`
