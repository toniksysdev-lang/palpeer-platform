# Palpeer Admin-End — Existing Project Audit (Phase 0)

**Date:** 2026-09-26  
**Gate:** GATE 0 — complete before any Admin-End UI implementation  
**Status:** COMPLETE — awaiting approval to start Phase 1

---

## 1. Executive summary

| Finding | Classification |
|--------|----------------|
| Repository is a **backend-only** Spring Boot multi-module monorepo | VERIFIED |
| **No existing React/Vite/Next frontend** (`package.json` absent at repo root and modules) | VERIFIED |
| Admin APIs exist under `/api/v1/admin/**` with JWT + permission RBAC | VERIFIED |
| OpenAPI export available at `docs/openapi.json` (~92 paths) | VERIFIED |
| Live API health on `http://localhost:8085/actuator/health` → `UP` | VERIFIED |
| Admin-End must be built as a **new separate app** in `palpeer-admin-end/` | RECOMMENDED |
| Many customer-facing domains (wallets, cards, chat, notifications, promotions) have **no dedicated admin list/detail APIs** | CONTRACT_PENDING for admin UI |

---

## 2. Repository inventory

### 2.1 Stack (VERIFIED)

| Layer | Technology |
|-------|------------|
| Language | Java 21 |
| Framework | Spring Boot 3.3.x (multi-module Maven) |
| DB | PostgreSQL + Flyway (V1–V21+) |
| Auth | JWT bearer (`bearerAuth`), refresh tokens |
| Admin module | `palpeer-admin` |
| Audit module | `palpeer-audit` |
| API docs | SpringDoc OpenAPI → `docs/openapi.json` |
| Config | `.env` / `.env.example`, `docker-compose.yml` |
| Frontend | **None** |

### 2.2 Modules present (VERIFIED)

`palpeer-app`, `palpeer-common`, `palpeer-auth`, `palpeer-user`, `palpeer-profile`, `palpeer-security`, `palpeer-admin`, `palpeer-audit`, `palpeer-kyc`, `palpeer-wallet`, `palpeer-ledger`, `palpeer-currency`, `palpeer-exchange`, `palpeer-transaction`, `palpeer-p2p`, `palpeer-negotiation`, `palpeer-chat`, `palpeer-card`, `palpeer-notification`, `palpeer-promotion`

### 2.3 Existing frontend / admin screens

| Item | Status |
|------|--------|
| React / Vite / Next.js app | **Missing** |
| Admin UI routes / components | **Missing** |
| Public marketing web | **Missing in this repo** |
| Reusable UI components | **N/A** |

**Conclusion:** There is nothing to “extend.” Phase 1+ must scaffold a greenfield Admin-End in `palpeer-admin-end/`.

---

## 3. Authentication model (VERIFIED)

Admin does **not** use a separate login endpoint.

1. Operator authenticates via customer auth: `POST /api/v1/auth/login` with `{ email, password }`.
2. Response: `AuthTokensResponse` — `userId`, `accessToken`, `refreshToken`, `tokenType`.
3. If the user is linked to an enabled `AdminUser`, JWT authorities are enriched with:
   - `ROLE_ADMIN`
   - `ROLE_<roleCode>` (e.g. `ROLE_SUPER_ADMIN`)
   - permission codes (e.g. `users:read`)
4. Class-level guard: `@PreAuthorize("hasAuthority('ROLE_ADMIN')")` on admin controllers.
5. Method-level permission checks (e.g. `users:read`, `kyc:review`).

**Bootstrap (STRONGLY INDICATED / P15-03 CONTRACT_PENDING for production invite flow):**  
`palpeer.admin.bootstrap-email` / `ADMIN_BOOTSTRAP_EMAIL` promotes an existing user to SUPER_ADMIN when no enabled admin exists.

**Forgot password:** customer flow exists (`/api/v1/auth/password-reset/*`). Admin-specific MFA/session management UI is CONTRACT_PENDING.

---

## 4. RBAC (VERIFIED from Flyway V19 + V20)

### Seeded permissions

| Code | Description |
|------|-------------|
| `users:read` | List/view users |
| `users:write` | Update user status/enabled |
| `kyc:read` | List/view KYC cases |
| `kyc:review` | Approve/reject KYC |
| `rates:write` | Publish exchange rates |
| `currencies:write` | Create currencies |
| `transactions:read` | View user transactions |
| `p2p:read` | View P2P requests/orders |
| `p2p:write` | Cancel/complete P2P |
| `promotions:write` | Create promotions |
| `admin:manage` | Manage admin users/roles |
| `audit:read` | Search audit logs (V20) |

### Seeded roles

| Code | Notes |
|------|-------|
| `SUPER_ADMIN` | Granted all seeded permissions |

**Frontend implication:** Implement `can("users:read")` etc. using authorities from the JWT (or a future `/me` admin endpoint). Do **not** invent additional roles (Operations, Compliance, Finance) until backend seeds them.

**Missing for UX (CONTRACT_PENDING):**

- Dedicated `GET /api/v1/admin/me` returning profile + permissions
- Fine-grained `rates:read`, `wallets:read`, `cards:read`, `chat:read`, `notifications:*`, `reports:*`
- Multiple operational roles beyond SUPER_ADMIN

---

## 5. Existing admin API surface (VERIFIED)

See `docs/admin-api-map.md` for full classification.

**Present today:**

- Users list/get/update
- KYC cases list + review
- Currency create + rate publish (admin + shared currency endpoints)
- Per-user transaction recent/history
- P2P requests/orders list + status update (CANCELLED/COMPLETED only — P15-05)
- Admin RBAC assign/list/disable
- Audit log search

**Absent as admin-specific APIs (CONTRACT_PENDING for Admin-End modules):**

- Dashboard / KPI aggregates
- Global transaction search (cross-user)
- Wallet inventory / wallet-by-id for any user
- Card inventory / freeze-unfreeze as admin
- Negotiation monitoring as admin
- Chat room monitoring / message access as admin
- Notification broadcast / templates
- Promotion admin CRUD beyond customer `promotions:write` permission seed
- Reports endpoints
- Global search
- WebSocket admin subscriptions

Customer modules (`/api/v1/wallets`, `/cards`, `/chat`, etc.) exist but are **user-scoped**; using them as admin tools without admin contracts would violate RULE 3/5.

---

## 6. KYC evidence (VERIFIED)

- Admin: `GET /api/v1/admin/kyc/cases`, `POST /api/v1/admin/kyc/cases/{caseId}/review`
- Review body: `{ status, rejectionReason? }` — statuses include SUBMITTED / UNDER_REVIEW / APPROVED / REJECTED (P15-04)
- Response shape (`KycStatusResponse`): `caseId`, `userId`, `status`, `rejectionReason`
- Document/selfie preview fields **not** in this admin DTO → document preview UI is CONTRACT_PENDING unless KYC detail endpoints are confirmed
- ComplyCube provider integration exists in backend; admin UI must not invent provider-specific actions

---

## 7. Financial / rate evidence (VERIFIED)

`ExchangeRateResponse`: `id`, `baseCurrencyCode`, `quoteCurrencyCode`, `buyRate`, `sellRate`, `effectiveDate`

Admin may publish rates via `POST /api/v1/admin/rates`.  
Do **not** invent spread/markup formulas on the frontend. Display backend values only.

---

## 8. Historical APK / public web evidence (STRONGLY INDICATED)

From the master prompt / reconstruction notes (not present as source in this repo):

- Historical API host: `https://afribdc-backend-0rhk.onrender.com/api/v1`
- Historical WS: `.../ws`
- Customer domains: auth, KYC, wallets, swap, P2P, negotiation/chat, cards, notifications, promotions

**Rule:** Treat as Level 2 evidence for UX expectations; current OpenAPI + Java controllers are Level 1 for implementation.

Env for Admin-End (planned):

```env
VITE_API_BASE_URL=
VITE_WS_URL=
VITE_APP_ENV=
VITE_USE_MOCK_API=
```

Do not hardcode the historical Render URL as production.

---

## 9. What can be reused

| Asset | Reuse plan |
|-------|------------|
| `docs/openapi.json` | Generate or hand-type API client types |
| Permission codes from V19/V20 | Frontend `can()` catalog |
| `ApiResponse<T>` envelope | Normalize in `services/api/client.ts` |
| Auth login/refresh/logout | Admin session |
| Backend money fields as strings/decimals | Display-only formatters |
| CONTRACT_PENDING.md | Drive CONTRACT_PENDING UI banners |
| Live local API `:8085` | Integration during Phase 2+ |

---

## 10. What must be rebuilt / created

| Area | Action |
|------|--------|
| Entire Admin-End SPA | New Vite + React + TypeScript + Tailwind app in `palpeer-admin-end/` |
| Design system | New (no existing UI kit) |
| App shell, auth, routing, tables, drawers | New |
| Mock mode | New (`VITE_USE_MOCK_API`) |
| Docs under `/docs/admin-*.md` | Phase 0 starts them; expand per phase |

---

## 11. Risks

| Risk | Mitigation |
|------|------------|
| Building pages for APIs that do not exist | CONTRACT_PENDING shells; no fake production data |
| Using customer endpoints as admin shortcuts | Forbidden until admin contracts exist |
| JWT does not embed permission list in a documented claim shape | Confirm claim enrichment / decode in Phase 2; may need `/admin/me` |
| KYC DTO lacks documents | Preview UI pending backend enrichment |
| No dashboard aggregates | KPI cards show unavailable until report APIs exist |
| Permission catalog incomplete vs prompt roles | Stick to seeded codes |

---

## 12. Recommended Phase 1 scope (after approval)

Create `palpeer-admin-end/` with:

1. Vite + React + TypeScript + Tailwind + React Router + TanStack Query + Zod
2. Design tokens (green/emerald/teal + light/dark/system)
3. Application shell: sidebar, header, breadcrumbs, collapse, toasts
4. Placeholder dashboard route (no fabricated metrics)
5. Env template + mock-mode banner
6. Docs stubs: `admin-architecture.md`, `admin-ui-map.md`, `admin-permissions.md`, `admin-contract-pending.md`, `admin-decisions.md`

**Do not** implement auth or live API modules until Phase 2 (after Gate 1).

---

## 13. Validation performed (Phase 0)

| Check | Result |
|-------|--------|
| Repo structure scan | Backend modules only; no frontend package.json |
| OpenAPI parse | 92 paths; 16 admin-related operations verified |
| `AdminController` / `AdminAuditController` source review | Matches OpenAPI |
| Flyway V19/V20 RBAC | Permissions + SUPER_ADMIN verified |
| `GET /actuator/health` on :8085 | `UP` |
| Application code written for Admin-End | **None** (per GATE 0) |

---

## 14. Gate 0 decision

**PASS** — audit complete.  

**STOP** — await explicit approval before Phase 1 scaffolding.
