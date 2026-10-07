# PALPEER Mobile — Phase 0 Project Audit

Audit date: 2026-09-28. Scope: the `palpeer-platform` repository, the reverse-engineered APK evidence, and the local toolchain. No application code was written in Phase 0.

Classification used throughout the mobile docs:

| Label | Meaning |
|---|---|
| **VERIFIED** | Read directly in the backend source in this repository. |
| **STRONGLY INDICATED** | Supported by APK evidence (hook names, strings, historical endpoints) but not backed by the current backend. |
| **CONTRACT_PENDING** | Neither verified nor safe to assume. UI may exist, behavior must not be faked. |

---

## 1. What exists in the repository

| Path | What it is | Relevance to mobile |
|---|---|---|
| `palpeer-app` + 20 `palpeer-*` modules | Spring Boot 3 / Java 21 modular monolith. REST under `/api/v1`, STOMP chat under `/ws`, PostgreSQL + Flyway (V1–V24). | **The authoritative backend contract.** Every customer endpoint is mapped in `mobile-api-map.md`. |
| `palpeer-admin-end` | Vite + React 19 + TanStack Query admin web app. | Not reusable as code (web DOM). Its patterns (envelope unwrapping, typed services, mock mode, permission-free customer flows) inform the mobile API layer. |
| `docs/` | Admin docs, `openapi.md`, `admin-*` maps. | Reference only. |
| `data/_master-prompt-extract.md` | Text extract of the master reconstruction spec including APK hook names and historical endpoints. | Reconstruction evidence. |
| `data/*` (apaylo/kuda/complycube notes) | Provider research used to build the backend rails. | Explains funding/withdrawal/KYC provider behaviour. |
| `CONTRACT_PENDING.md` | Backend-wide pending contract list. | Source for `mobile-contract-pending.md`. |

**Existing mobile source: none.** No Expo/React Native project, `app.json`, `eas.json`, Android/iOS folder, or mobile tests exist anywhere in the repository (searched excluding `node_modules`).

**APK binary: not present.** No `.apk`/`.aab` is in the repository. APK evidence is only available as text (hook names, strings, endpoints, package `com.covenantcodes.palpeer`, Expo SDK 56, Hermes, New Architecture, RTK Query, STOMP, Firebase). It could not be re-inspected.

**Conclusion:** this is a greenfield mobile build against an existing, verified backend. There is no mobile code to reuse or migrate.

---

## 2. Toolchain found

| Tool | Version | Notes |
|---|---|---|
| Node.js | 24.19.0 | OK for Expo SDK 57. |
| npm | 11.17.0 | OK. |
| Java | OpenJDK 21.0.12 | Needed only for the backend and local Android builds. |
| Expo (latest on npm) | 57.0.25 | APK was SDK 56; recommend starting on 57. |
| expo-router (latest) | 57.0.23 | |
| react-native (latest) | 0.87.1 | Resolved by `expo install`, not pinned by hand. |
| @stomp/stompjs (latest) | 7.3.0 | Pure JS STOMP client, works in React Native. |
| Android SDK / `ANDROID_HOME` | **Not set** | Local Android builds and emulator E2E need Android Studio, or use EAS cloud builds plus a physical device with a development build. |
| Xcode | n/a (Windows) | iOS builds only via EAS cloud. |

Backend runs locally at `http://localhost:8085/api/v1` (Postgres via `docker-compose.yml`). A phone on the LAN needs the machine's LAN IP, not `localhost`.

---

## 3. Backend facts that shape the mobile app (VERIFIED)

Full detail in `mobile-api-map.md`. The ones that change design decisions:

1. **Current paths differ from the APK.** For example `/auth/createUser` became `POST /auth/register` and `/wallet/getUserWallets` became `GET /wallets`. The mobile app targets the current backend; the APK paths are historical only (mapping table in `mobile-api-map.md` section 10).
2. **Envelope.** Every JSON response is `ApiResponse { success, message, data, errors?, timestamp }`. Errors carry `code` and validation details. STOMP messages are *not* wrapped.
3. **Tokens.** Access JWT 15 min, refresh 14 days, **rotating** refresh (`POST /auth/refresh` revokes the old one). Login returns `{ userId, accessToken, refreshToken, tokenType }` with no expiry field.
4. **Expired/missing token returns 403 with an empty body, not 401.** The client must treat an empty-body 403 on an authenticated call as "try one refresh".
5. **Unverified users can log in.** Login does not require email/phone verification or KYC. The app decides what to show, but must not claim the backend enforces a gate it doesn't.
6. **Money is JSON numbers** (Jackson `BigDecimal`), up to 12 decimal places, occasionally scientific notation. The client must parse amounts losslessly (see architecture doc, "Money handling").
7. **Idempotency-Key header is required** on `POST /funding`, `POST /withdrawals`, `POST /exchange/execute`. Missing header currently returns 500.
8. **No endpoint requires a transaction PIN.** The PIN exists (`/security/pin`) and can be verified, but money endpoints don't check it.
9. **STOMP:** SockJS endpoint `/ws` (native WebSocket at `/ws/websocket`), send to `/app/rooms/{roomId}/send`, subscribe `/topic/rooms.{roomId}`, auth via `Authorization: Bearer` header on CONNECT. Chat rooms exist per **P2P order** only.
10. **No "get my user info" endpoint**, no biometric protocol, no security-question catalogue, no wallet delete, no card funding/withdrawal, no P2P order lifecycle, no list-my-orders, no negotiation list.
11. **Funding** has no method choice: the rail comes from wallet currency (CAD uses Apaylo Interac e-Transfer, NGN uses a Kuda virtual account). Both rails are **disabled in dev**, so funding stays `INITIATED`.

---

## 4. Security issues found in the backend (must be fixed before production)

These do not block building the mobile UI, but the app must never be released against a backend with them. Detail and severity in `mobile-api-map.md` section 9.

| # | Severity | Issue |
|---|---|---|
| 1 | **Critical** | `POST /funding/{id}/process`, `/fail`, `/reverse` and the withdrawal equivalents have no role check. A customer can credit their own wallet with any amount, or reclaim a paid-out withdrawal. Confirmed in `FundingController`. |
| 2 | **Critical** | `/api/v1/webhooks/apaylo` and `/kuda` are public with no signature verification, and a body with no status is treated as success. Anyone can credit a wallet by posting `{"fundingId": "..."}`. Confirmed in `PaymentWebhookController` + `SecurityConfig`. |
| 3 | High | ComplyCube webhook signature check is skipped when no secret is configured (default). |
| 4 | High | STOMP SUBSCRIBE is not authorized: any logged-in user can read any chat room. |
| 5 | High | `POST /security/pin/verify` has no attempt limit or lockout. |

**Update (2026-09-28): issues 1–5 are fixed in the backend** (operator-only money-movement endpoints with `payments:operate`, fail-closed HMAC webhooks, STOMP SUBSCRIBE/SEND authorization, PIN lockout). See `mobile-contract-pending.md` SEC-1..SEC-5. Issue 6 remains open.
| 6 | Medium | Unlimited OTP resends, account enumeration via OTP endpoints, access tokens valid 15 min after logout, unverified accounts can move money. |

The mobile app will never call `process`/`fail`/`reverse` or webhooks.

---

## 5. Reuse assessment

| Item | Decision | Why |
|---|---|---|
| Existing mobile code | n/a | None exists. |
| Admin web code | Do not reuse | DOM/Tailwind web components; different audience. |
| Admin web *patterns* | Reuse conceptually | Envelope unwrapping, typed services, error normalisation, mock toggle. |
| Backend DTO shapes | Reuse as the typed contract | Mirror verified DTOs into `src/types/api/*`. |
| APK hook names | Reuse as RTK Query endpoint names where a verified endpoint exists | Keeps parity with the original app (`useGetUserWalletsQuery` etc.). |
| APK strings | Reuse for copy where the behaviour still matches | E.g. "No Wallets Available", "Create a new wallet to get started". |
| Historical base URL (`afribdc-backend-0rhk.onrender.com`) | Do not use | Not this backend. Base URL comes from `EXPO_PUBLIC_API_BASE_URL`. |

---

## 6. Folder created

`palpeer-mobile/` at the repository root, separate from the backend and admin web app. Phase 0 contains only `palpeer-mobile/docs/`. The Expo project is scaffolded into this folder in Phase 1 after approval.

## 7. Phase 0 validation results

| Check | Result |
|---|---|
| Repository inspected for existing mobile source, Expo config, native folders, env files, tests | Done; none exist |
| APK inspected | Not available as a binary; text evidence reviewed |
| API layer mapped | 96 customer-side REST endpoints + STOMP, all read in code (`mobile-api-map.md`) |
| Screens mapped | `mobile-screen-map.md` |
| Navigation mapped | `mobile-architecture.md`, `mobile-screen-map.md` |
| Native capabilities mapped | `mobile-architecture.md` section 8 |
| Missing contracts identified | `mobile-contract-pending.md` |
| Two critical security claims re-checked by hand | Confirmed (funding `process` has no role check; webhooks public and unsigned) |
| Application code written | None (per Gate 0) |
