# Admin decisions log

## 2026-09-26 — Phase 18

- Master prompt has no Phase 18; treated as Final Definition of Done audit.
- Settings implemented with verified `GET/POST /admin/admins` + disable (`admin:manage`).
- Sidebar nav list scrolls so logout stays reachable; skip-to-content link added.
- DoD report: `docs/admin-definition-of-done.md`.

## 2026-09-26 — Phase 17

- Production gate: install, lint, typecheck, test, build, preview/dev smoke all passed.
- Confirmed production bundle sets `useMockApi: false` (`BC=!1`) even when `VITE_USE_MOCK_API=true` at build time.
- Added `.env.production.example` with https placeholders; no secrets committed.
- `npm audit --omit=dev`: 0 vulnerabilities.

## 2026-09-26 — Phase 16

- Added Vitest + Testing Library + Playwright.
- Unit/component/integration suites cover formatters, permissions, redirects, JWT/session, table/dialog/status/input, and mock auth/users/tx/rates/P2P.
- E2E covers the 10 critical admin workflows against mock mode.
- Phase 15 UX polish was skipped at user request.

## 2026-09-26 — Phase 14

- Security review: no critical findings; residual web-storage XSS risk documented.
- Hardened: open-redirect sanitization, RequireAuth `isAdmin` gate, JWT shape checks, fetch `credentials: 'omit'`, prod HTTPS URL enforcement, security headers, env file gitignore.
- `npm audit`: 0 vulnerabilities.
- See `docs/admin-security.md`.

## 2026-09-26 — Phase 13

- Reports: no `/admin/reports*` — CONTRACT_PENDING shell only; no fabricated metrics/exports.
- Audit: verified `GET /admin/audit-logs` with filters (`userRef`, `action`, `entity`, `from`, `to`) + pageable; `audit:read`.
- Detail drawer limited to AuditLogResponse fields (no invented result/resource-id columns).
- Settings remains shell-only (Phase 13 scope is Reports + Audit).

## 2026-09-26 — Phase 12

- Notifications admin center/broadcast remains CONTRACT_PENDING (inbox APIs are user-scoped).
- Promotions: verified `GET /promotions/active` + `POST /promotions` (`promotions:write`) with confirmation.
- Referral/bonus “mine” endpoints not used as admin inventory; campaign formulas not invented.

## 2026-09-26 — Phase 0

- Build Admin-End as new app in `palpeer-admin-end/` (no existing frontend).
- Treat OpenAPI + Spring controllers as Level 1 API truth.
