# Admin test plan

## Phase 18 (Gate 18 — Definition of Done)

- [x] DoD checklist documented (`docs/admin-definition-of-done.md`)
- [x] Settings: profile + theme + verified admin RBAC; MFA CONTRACT_PENDING
- [x] Sidebar scroll + skip-to-content a11y
- [x] `npm run lint` / `typecheck` / `test` / `build`

## Phase 17 (Gate 17)

- [x] `npm install`
- [x] `npm run lint`
- [x] `npm run typecheck`
- [x] `npm run test` (29 passed)
- [x] `npm run build` (production; mock forced off even if `VITE_USE_MOCK_API=true`)
- [x] `npm run preview` smoke (HTTP 200)
- [x] `npm run dev` smoke (HTTP 200)
- [x] `npm audit --omit=dev` → 0 vulnerabilities

## Phase 16 (Gate 16)

- [x] Unit tests: formatters, permissions, safeRedirect, JWT/token shape, session
- [x] Component tests: DataTable, ConfirmDialog, StatusBadge, Input
- [x] Integration tests (mock): auth, users, transactions, rates, P2P
- [x] E2E critical workflows (Playwright, mock mode): login → dashboard → users → txs → rates → KYC → P2P → logout
- [x] Scripts: `npm run test`, `npm run test:e2e`, `npm run test:all`
- [x] `npm run typecheck` / `lint` / `test` / `build`

## Phase 14 (Gate 14)

- [x] AuthN/AuthZ/route-guard review
- [x] Token storage + sensitive data review
- [x] XSS/CSRF/logging/env/dependency review
- [x] Hardening applied (redirect, JWT shape, credentials omit, HTTPS prod URLs, headers)
- [x] `docs/admin-security.md` written
- [x] `npm audit` → 0 vulnerabilities
- [x] `npm run typecheck` / `lint` / `build`

## Phase 13 (Gate 13)

- [x] Reports: CONTRACT_PENDING shell (no report endpoints)
- [x] Audit: `GET /admin/audit-logs` with userRef/action/entity/from/to + pagination
- [x] Permission boundary: `audit:read`
- [x] Detail drawer uses only verified AuditLogResponse fields
- [x] `npm run typecheck` / `lint` / `build`

## Phase 12 (Gate 12)

- [x] Notifications: CONTRACT_PENDING (no admin broadcast; inbox APIs unused)
- [x] Promotions: list active + create with permission + confirmation
- [x] No invented campaign formulas / referral admin inventory
- [x] `npm run typecheck` / `lint` / `build`

## Phase 11 (Gate 11)

- [x] Confirmed no admin card inventory API
- [x] Live CONTRACT_PENDING; owner-scoped `/cards` not used as admin feed
- [x] Masked `lastFour` only in mock preview — no PAN/CVV
- [x] Admin freeze/funding controls omitted (unverified)
- [x] `npm run typecheck` / `lint` / `build`

## Phase 10 (Gate 10)

- [x] Confirmed no admin negotiation/chat inventory APIs
- [x] Live: CONTRACT_PENDING (no participant API misuse)
- [x] Chat message content not loaded in live mode
- [x] No STOMP/WebSocket admin connection
- [x] Mock fixtures for layout preview only
- [x] `npm run typecheck` / `lint` / `build`

## Phase 9 (Gate 9)

- [x] P2P requests + orders lists
- [x] Detail drawer with verified fields
- [x] Admin status update CANCELLED/COMPLETED only (`p2p:write`)
- [x] Confirmation before status change
- [x] Client-side status filter labeled (no invented server filters)
- [x] `npm run typecheck` / `lint` / `build`

## Phase 8 (Gate 8)

- [x] Per-user transaction history with type/date/page filters
- [x] Recent mode via verified admin recent endpoint
- [x] Detail drawer with backend status/amount/wallets/failure fields
- [x] Global cross-user search marked CONTRACT_PENDING
- [x] Permission `transactions:read`
- [x] `npm run typecheck` / `lint` / `build`

## Phase 7 (Gate 7)

- [x] Currency list from verified API
- [x] Pair latest + history (backend buy/sell display-only)
- [x] Publish rate via `POST /admin/rates` with confirmation (`rates:write`)
- [x] Create currency via `POST /admin/currencies` (`currencies:write`)
- [x] No invented spread/markup formulas
- [x] CONTRACT_PENDING for global matrix / P2P-vs-swap split
- [x] `npm run typecheck` / `lint` / `build`

## Phase 6 (Gate 6)

- [x] Confirmed no admin wallet inventory API (user-scoped `/wallets` only)
- [x] Live mode: CONTRACT_PENDING (no fake balances)
- [x] Mock mode: fixture table/detail for UI preview only
- [x] No client-side balance calculation
- [x] Customer wallet endpoints not used as admin shortcuts
- [x] `npm run typecheck` / `lint` / `build`

## Phase 5 (Gate 5)

- [x] KYC list with pagination + `kyc:read`
- [x] Case detail/review with confirmation + `kyc:review`
- [x] Rejection reason required when REJECTED
- [x] Documents/selfies marked CONTRACT_PENDING (not fabricated)
- [x] Sensitive media not requested or displayed
- [x] `npm run typecheck` / `lint` / `build`
- [ ] Manual: live review against local `:8085`

## Phase 4 (Gate 4)

- [x] Users list with pagination + sort
- [x] Permission gating (`users:read` / `users:write` / `transactions:read`)
- [x] User detail profile fields from verified DTO
- [x] Status/enabled update with confirmation
- [x] Recent + history transactions panels
- [x] Search/status filters marked CONTRACT_PENDING (not invented)
- [x] `npm run typecheck` / `lint` / `build`
- [ ] Manual: live update against local `:8085`

## Phase 3 (Gate 3)

- [x] Dashboard integrates verified admin APIs (users, KYC, P2P, audit, currencies)
- [x] Loading skeletons on panels/KPIs
- [x] Error states with retry
- [x] Empty states when lists are empty
- [x] CONTRACT_PENDING tiles for unverified aggregates (no fake volume/revenue)
- [x] Permission-aware panel gating (`users:read`, `kyc:read`, `p2p:read`, `audit:read`)
- [x] Responsive layout retained
- [x] `npm run typecheck` / `lint` / `build`
- [ ] Manual: live data against local `:8085` with bootstrap admin

## Phase 2 (Gate 2)

- [x] Login page at `/sign-in`
- [x] Unauthenticated users cannot access `/admin`
- [x] Authenticated admin session reaches `/admin/dashboard`
- [x] Logout clears session and returns to sign-in
- [x] Expired/invalid session redirects with message
- [x] Non-admin login rejected after token issue (live probe)
- [x] `npm run typecheck` / `lint` / `build`
- [ ] Manual: remember-session persistence across reload
- [ ] Manual: live API login against local `:8085` with bootstrap admin

## Phase 1 (Gate 1)

- [x] `npm install`
- [x] `npm run typecheck`
- [x] `npm run lint` (0 errors; provider hook export warnings suppressed)
- [x] `npm run build`
- [ ] Desktop: sidebar expand/collapse persists (manual)
- [ ] Mobile: hamburger opens drawer; overlay closes (manual)
- [ ] Theme cycle: light → dark → system (manual)
- [ ] Navigate all `/admin/*` routes (manual)
- [x] Mock banner when `VITE_USE_MOCK_API=true`
- [x] Dashboard shows CONTRACT_PENDING for KPIs (no fake metrics)
- [x] Reduced-motion CSS media query present

## Later phases

Auth, users, KYC, rates, transactions, P2P, and e2e flows are defined in the master prompt Phases 2–16.
