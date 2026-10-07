# Palpeer Admin-End — API Map (Phase 0)

**Date:** 2026-09-26  
**Sources:** `docs/openapi.json`, `AdminController`, `AdminAuditController`, Flyway V19/V20, `CONTRACT_PENDING.md`  
**Base URL (local verified):** `http://localhost:8085`  
**API prefix:** `/api/v1`

Classification:

| Label | Meaning |
|-------|---------|
| **VERIFIED** | Present in OpenAPI + backend source |
| **STRONGLY INDICATED** | Customer/APK evidence or related permission exists; admin contract incomplete |
| **CONTRACT_PENDING** | Needed for Admin-End UX; no verified admin API |

Envelope (VERIFIED pattern): responses wrapped as `ApiResponse<T>` (success message + data). Auth: `Authorization: Bearer <accessToken>`.

---

## 1. Authentication (shared with platform)

| Method | Path | Status | Admin use | Permission |
|--------|------|--------|-----------|------------|
| POST | `/auth/login` | VERIFIED | Admin sign-in | Public |
| POST | `/auth/refresh` | VERIFIED | Session refresh | Public (refresh token) |
| POST | `/auth/logout` | VERIFIED | Sign-out | Authenticated |
| POST | `/auth/password-reset/request` | VERIFIED | Forgot password UX | Public |
| POST | `/auth/password-reset/confirm` | VERIFIED | Reset confirm | Public |
| POST | `/auth/otp/verify` | VERIFIED | Not primary admin path | Public |
| POST | `/auth/otp/resend` | VERIFIED | Not primary admin path | Public |
| POST | `/auth/register` | VERIFIED | Not for admin console | Public |

**Login request (VERIFIED):** `{ email, password }`  
**Login response (VERIFIED):** `{ userId, accessToken, refreshToken, tokenType }`

| Gap | Status |
|-----|--------|
| Admin MFA endpoints | CONTRACT_PENDING |
| Dedicated admin login | Not required (same JWT) |

---

## 2. Admin users & platform users

| Method | Path | Status | Permission |
|--------|------|--------|------------|
| GET | `/admin/users` | VERIFIED | `users:read` |
| GET | `/admin/users/{userId}` | VERIFIED | `users:read` |
| PUT | `/admin/users/{userId}` | VERIFIED | `users:write` |

**AdminUserSummaryResponse (VERIFIED):**  
`id`, `email`, `phone`, `status`, `enabled`, `emailVerified`, `phoneVerified`, `createdAt`

**UpdateUserAdminRequest (VERIFIED):**  
`status?` ∈ `PENDING_VERIFICATION | ACTIVE | SUSPENDED | CLOSED`, `enabled?`

| Gap | Status |
|-----|--------|
| User search/filter query params beyond pageable | CONTRACT_PENDING (pageable only today) |
| Last activity, KYC status on list DTO | CONTRACT_PENDING |
| User detail aggregate (wallets/cards/P2P tabs) | CONTRACT_PENDING as dedicated admin resources |

---

## 3. Admin RBAC

| Method | Path | Status | Permission |
|--------|------|--------|------------|
| GET | `/admin/me` | VERIFIED | `ROLE_ADMIN` |
| GET | `/admin/admins` | VERIFIED | `admin:manage` |
| POST | `/admin/admins` | VERIFIED | `admin:manage` |
| POST | `/admin/admins/{userId}/disable` | VERIFIED | `admin:manage` |
| GET | `/admin/roles` | VERIFIED | `admin:manage` |
| GET | `/admin/roles/{code}` | VERIFIED | `admin:manage` |
| POST | `/admin/roles` | VERIFIED | `admin:manage` |
| PUT | `/admin/roles/{code}` | VERIFIED | `admin:manage` |
| GET | `/admin/permissions` | VERIFIED | `admin:manage` |
| POST | `/admin/permissions` | VERIFIED | `admin:manage` |

**AssignAdminRequest (VERIFIED):** `{ userId, roleCodes[] }`  
**CreateRoleRequest (VERIFIED):** `{ code, name, description?, permissionCodes[] }`  
**UpdateRoleRequest (VERIFIED):** `{ name?, description?, permissionCodes? }`  
**CreatePermissionRequest (VERIFIED):** `{ code, description? }`  
**AdminMeResponse (VERIFIED):** `userId`, `email`, `enabled`, `roleCodes[]`, `permissionCodes[]`

| Gap | Status |
|-----|--------|
| Delete role / delete permission | CONTRACT_PENDING (avoid accidental lockout) |
| Role code rename | Not supported — codes are immutable |

---

## 4. KYC

| Method | Path | Status | Permission |
|--------|------|--------|------------|
| GET | `/admin/kyc/cases` | VERIFIED | `kyc:read` |
| POST | `/admin/kyc/cases/{caseId}/review` | VERIFIED | `kyc:review` |

**KycStatusResponse (VERIFIED):** `caseId`, `userId`, `status`, `rejectionReason`  
**ReviewKycRequest (VERIFIED):** `{ status, rejectionReason? }`

| Gap | Status |
|-----|--------|
| Document / selfie preview URLs | CONTRACT_PENDING |
| KYC timeline / reviewer history in DTO | CONTRACT_PENDING |
| Filter by status query param | CONTRACT_PENDING (pageable list only) |

Customer KYC (`/api/v1/kyc/**`) remains user-scoped — STRONGLY INDICATED for domain, not admin list.

---

## 5. Currencies & rates

| Method | Path | Status | Permission / notes |
|--------|------|--------|--------------------|
| POST | `/admin/currencies` | VERIFIED | `currencies:write` |
| POST | `/admin/rates` | VERIFIED | `rates:write` |
| GET | `/currencies` | VERIFIED | Authenticated currency list |
| GET | `/currencies/{code}` | VERIFIED | Get by code |
| POST | `/currencies` | VERIFIED | Admin create (duplicate surface) |
| GET | `/exchange-rates` | VERIFIED | History for a pair |
| GET | `/exchange-rates/latest` | VERIFIED | Latest effective rate |
| POST | `/exchange-rates` | VERIFIED | Admin publish (duplicate surface) |

**ExchangeRateResponse (VERIFIED):**  
`id`, `baseCurrencyCode`, `quoteCurrencyCode`, `buyRate`, `sellRate`, `effectiveDate`

| Gap | Status |
|-----|--------|
| `rates:read` permission | CONTRACT_PENDING (read uses authenticated currency endpoints) |
| P2P vs swap rate admin split fields | CONTRACT_PENDING — do not invent |
| Rate approval workflow | CONTRACT_PENDING |
| Rate deactivate / soft-delete | CONTRACT_PENDING |

---

## 6. Transactions

| Method | Path | Status | Permission |
|--------|------|--------|------------|
| GET | `/admin/users/{userId}/transactions/recent` | VERIFIED | `transactions:read` |
| GET | `/admin/users/{userId}/transactions/history` | VERIFIED | `transactions:read` |

Query (history): `type?`, `from?`, `to?`, `page`, `size`

**TransactionItemResponse (VERIFIED):**  
`type`, `id`, `status`, `walletId`, `secondaryWalletId`, `currencyCode`, `secondaryCurrencyCode`, `amount`, `secondaryAmount`, `appliedRate`, `failureReason`, `ledgerEntryIds`, `createdAt`, `updatedAt`

| Gap | Status |
|-----|--------|
| Global `/admin/transactions` search across users | CONTRACT_PENDING |
| Export endpoint | CONTRACT_PENDING |
| Dashboard volume aggregates | CONTRACT_PENDING |

Customer `/api/v1/transactions/**` — STRONGLY INDICATED for shapes; not admin global search.

---

## 7. P2P

| Method | Path | Status | Permission |
|--------|------|--------|------------|
| GET | `/admin/p2p/requests` | VERIFIED | `p2p:read` |
| GET | `/admin/p2p/orders` | VERIFIED | `p2p:read` |
| PUT | `/admin/p2p/requests/{requestId}/status` | VERIFIED | `p2p:write` |
| PUT | `/admin/p2p/orders/{orderId}/status` | VERIFIED | `p2p:write` |

**P2PRequestResponse (VERIFIED):**  
`id`, `userId`, `side`, `baseCurrencyCode`, `quoteCurrencyCode`, `amount`, `rate`, `status`, `expiresAt`, `notes`, `createdAt`

**Admin status updates (P15-05 VERIFIED intent):** CANCELLED or COMPLETED only — frontend must not offer other transitions.

| Gap | Status |
|-----|--------|
| Admin P2P filters / pagination | CONTRACT_PENDING (list returns `List`, not page) |
| Completed-orders dedicated admin view | STRONGLY INDICATED via list + status filter client-side only if backend returns all |

---

## 8. Audit logs

| Method | Path | Status | Permission |
|--------|------|--------|------------|
| GET | `/admin/audit-logs` | VERIFIED | `audit:read` |

Query: `userRef?`, `action?`, `entity?`, `from?`, `to?`, pageable

**AuditLogResponse (VERIFIED):**  
`id`, `createdAt`, `userRef`, `action`, `entity`, `oldValue`, `newValue`, `ipAddress`, `device`

---

## 8b. Referrals & bonuses (admin inventory)

| Method | Path | Status | Permission |
|--------|------|--------|------------|
| GET | `/admin/referrals` | VERIFIED | `promotions:write` |
| GET | `/admin/referrals/{id}` | VERIFIED | `promotions:write` |
| GET | `/admin/bonuses` | VERIFIED | `promotions:write` |

Query (referrals): `status?`, `referralCode?`, `referrerUserId?`, `refereeUserId?`, pageable  
Query (bonuses): `status?`, `userId?`, `referralId?`, pageable  

**ReferralResponse (VERIFIED):** `id`, `referrerUserId`, `refereeUserId`, `referralCode`, `status`, `promotionId`, `createdAt`  
**BonusResponse (VERIFIED):** `id`, `userId`, `promotionId`, `referralId`, `amount`, `currencyCode`, `status`, `reason`, `ledgerEntryId`, `createdAt`

| Gap | Status |
|-----|--------|
| Bonus ledger CREDIT / settlement | CONTRACT_PENDING (P14-03) |
| Campaign eligibility / performance engines | CONTRACT_PENDING |

Customer `/promotions/referrals/mine` and `/bonuses/mine` remain user-scoped — not used as admin inventory.

---

## 9. Domains without admin APIs

| Admin UI module (prompt) | Backend customer APIs | Admin API | Classification |
|--------------------------|----------------------|-----------|----------------|
| Dashboard KPIs | None | None | CONTRACT_PENDING |
| Wallets inventory | `/wallets/**` | `/admin/wallets[/{id}[/transactions]]` | VERIFIED (`wallets:read`) |
| Cards inventory / block | `/cards/**` | `/admin/cards*` + block/unblock | VERIFIED (`cards:read` / `cards:write`) |
| Negotiations monitor | `/negotiations/**` | `/admin/negotiations[/{id}]` | VERIFIED (`negotiations:read`) |
| Chat monitor (REST) | `/chat/**` + WS | `/admin/chat/rooms*` | VERIFIED (`chat:read`); STOMP still pending |
| Notifications inventory | `/notifications/**` | `/admin/notifications` | VERIFIED (`notifications:read`); broadcast pending |
| Promotions admin CRUD beyond create/active | `/promotions/**` + `promotions:write` | Create + active list verified; full CRUD still limited | STRONGLY INDICATED / partial |
| Referral/bonus admin inventory | Domain + customer “mine” APIs | `/admin/referrals`, `/admin/bonuses` | VERIFIED |
| Reports | None | None | CONTRACT_PENDING |
| Global search | None | None | CONTRACT_PENDING |
| Settings / MFA | `/security/**` | Partial customer security | CONTRACT_PENDING for admin settings |

---

## 10. WebSocket / realtime

| Item | Status |
|------|--------|
| Historical WS URL evidence | STRONGLY INDICATED (APK) |
| Current Spring WS admin subscription contract | CONTRACT_PENDING |
| Chat STOMP destinations for admin monitoring | CONTRACT_PENDING |

REST chat inventory is VERIFIED; do not invent STOMP admin subscriptions.

---

## 11. Permission → UI module mapping (for Phase 2+)

| UI area | Required permission(s) | Data readiness |
|---------|------------------------|----------------|
| Users | `users:read` / `users:write` | VERIFIED |
| KYC | `kyc:read` / `kyc:review` | VERIFIED (limited DTO) |
| Rates / currencies | `rates:write` / `currencies:write` (+ read via currency APIs) | VERIFIED |
| Transactions (per user) | `transactions:read` | VERIFIED |
| Transactions (global) | — | CONTRACT_PENDING |
| P2P | `p2p:read` / `p2p:write` | VERIFIED |
| Audit | `audit:read` | VERIFIED |
| Admin settings / RBAC | `admin:manage` | VERIFIED (admins, roles, permissions, `/admin/me`) |
| Wallets | `wallets:read` | VERIFIED |
| Cards | `cards:read` / `cards:write` | VERIFIED |
| Negotiations | `negotiations:read` | VERIFIED |
| Chat (REST) | `chat:read` | VERIFIED |
| Notifications | `notifications:read` | VERIFIED (list only) |
| Reports | — | CONTRACT_PENDING |

---

## 12. Historical APK endpoints (Level 2 — do not implement as admin unless re-verified)

Examples from reconstruction prompt (STRONGLY INDICATED, not current admin OpenAPI):

- `/auth/createUser`, `/auth/login`, … (legacy naming differs from current `/api/v1/auth/*`)
- `/wallet/*`, `/display-rate/*`, `/p2pRequest/*`, `/p2pOrder/*`, `/negotiation/*`, `/virtualCard/*`

**Current backend naming differs.** Prefer OpenAPI paths above.

---

## 13. Mock mode policy

When Admin-End implements `VITE_USE_MOCK_API=true`:

- Mock data allowed for shell/layout/table UX only
- Banner must show mock mode
- Production builds must force mock off
- Never present mock as live operational data

---

## 14. Phase 0 API verdict

| Category | Count / note |
|----------|--------------|
| VERIFIED admin operations | Users/KYC/rates/tx/P2P/audit/RBAC + wallets/cards/negotiations/chat/notifications inventory |
| VERIFIED auth operations for session | 8 under `/auth/**` |
| CONTRACT_PENDING admin modules | Dashboard aggregates, global txs, notification broadcast, reports, global search, admin MFA, chat STOMP |
