# PALPEER Mobile API Map (verified backend contract)

Audit date: 2026-09-28. Source: `d:\projects\palpeer-platform` (Spring Boot 3.3.5, Java 21, multi-module Maven).
Every endpoint below was read in code (controller + DTO + service) and is marked **VERIFIED**. Field names are copied verbatim.
No Java code was modified to produce this document.

Base URL: `http(s)://<host>:8080` (`server.port=${SERVER_PORT:8080}`, no servlet context path). All REST paths start with `/api/v1`.

---

## Table of contents

1. [Global conventions](#1-global-conventions)
   - 1.1 [Response envelope (`ApiResponse`)](#11-response-envelope-apiresponse)
   - 1.2 [Error envelope and HTTP status mapping](#12-error-envelope-and-http-status-mapping)
   - 1.3 [Authentication and unauthenticated behaviour](#13-authentication-and-unauthenticated-behaviour)
   - 1.4 [Pagination shapes](#14-pagination-shapes)
   - 1.5 [JSON serialization: money, dates, ids, enums](#15-json-serialization-money-dates-ids-enums)
   - 1.6 [Idempotency-Key header](#16-idempotency-key-header)
   - 1.7 [Transaction PIN usage](#17-transaction-pin-usage)
2. [Auth token model](#2-auth-token-model)
3. [Endpoints](#3-endpoints)
   - 3.1 [Auth `/api/v1/auth`](#31-auth-apiv1auth)
   - 3.2 [Profile `/api/v1/profiles`](#32-profile-apiv1profiles)
   - 3.3 [KYC `/api/v1/kyc`](#33-kyc-apiv1kyc)
   - 3.4 [Security `/api/v1/security`](#34-security-apiv1security)
   - 3.5 [Wallets `/api/v1/wallets`](#35-wallets-apiv1wallets)
   - 3.6 [Funding `/api/v1/funding`](#36-funding-apiv1funding)
   - 3.7 [Withdrawals `/api/v1/withdrawals`](#37-withdrawals-apiv1withdrawals)
   - 3.8 [Currencies and exchange rates `/api/v1`](#38-currencies-and-exchange-rates-apiv1)
   - 3.9 [Instant exchange `/api/v1/exchange`](#39-instant-exchange-apiv1exchange)
   - 3.10 [P2P `/api/v1/p2p`](#310-p2p-apiv1p2p)
   - 3.11 [Negotiations `/api/v1/negotiations`](#311-negotiations-apiv1negotiations)
   - 3.12 [Chat REST `/api/v1/chat`](#312-chat-rest-apiv1chat)
   - 3.13 [Chat WebSocket / STOMP](#313-chat-websocket--stomp)
   - 3.14 [Transactions feed `/api/v1/transactions`](#314-transactions-feed-apiv1transactions)
   - 3.15 [Cards `/api/v1/cards`](#315-cards-apiv1cards)
   - 3.16 [Notifications `/api/v1/notifications`](#316-notifications-apiv1notifications)
   - 3.17 [Promotions and referrals `/api/v1/promotions`](#317-promotions-and-referrals-apiv1promotions)
   - 3.18 [Webhooks (server-to-server, not for mobile)](#318-webhooks-server-to-server-not-for-mobile)
4. [Enums the app must render](#4-enums-the-app-must-render)
5. [Funding methods and providers](#5-funding-methods-and-providers)
6. [KYC upload constraints](#6-kyc-upload-constraints)
7. [Card data exposure](#7-card-data-exposure)
8. [Biometric and security-question catalogue](#8-biometric-and-security-question-catalogue)
9. [Security issues found](#9-security-issues-found)
10. [Historical APK endpoint → current backend mapping](#10-historical-apk-endpoint--current-backend-mapping)
11. [Capabilities in the APK with no backend support](#11-capabilities-in-the-apk-with-no-backend-support)
12. [Endpoint count summary](#12-endpoint-count-summary)

---

## 1. Global conventions

### 1.1 Response envelope (`ApiResponse`)

Source: `palpeer-common/.../api/ApiResponse.java`. Class-level `@JsonInclude(NON_NULL)` applies to the envelope fields only (nested DTO records still serialize `null` fields as `null`).

| Field | Type | Notes |
|---|---|---|
| `success` | boolean | Always present. `true` on success, `false` on error. |
| `message` | string | Omitted when null. Success messages are endpoint-specific (listed per endpoint); many GET endpoints send no message. |
| `data` | T | Omitted when null. Endpoints returning `ApiResponse<Void>` have **no `data` key**. |
| `error` | `ApiError` | Only on failures (see 1.2). |
| `timestamp` | string (ISO-8601 `Instant`, e.g. `2026-09-28T16:31:00.123Z`) | Always present. |

Success example:

```json
{ "success": true, "message": "Wallet created", "data": { "id": "…" }, "timestamp": "2026-09-28T16:31:00.123Z" }
```

Exception: `DELETE /api/v1/notifications/device-tokens/{tokenId}` returns **204 No Content with no body** (no envelope).

### 1.2 Error envelope and HTTP status mapping

`ApiError` (`@JsonInclude(NON_NULL)`):

| Field | Type | Notes |
|---|---|---|
| `code` | string | Stable machine code (e.g. `VALIDATION_FAILED`, `INSUFFICIENT_AVAILABLE_BALANCE`). |
| `detail` | string | Human message (same as the envelope `message` for business errors). |
| `violations` | array of `{ field: string, message: string }` | Only for `VALIDATION_FAILED`. |

Error example (validation):

```json
{
  "success": false,
  "message": "Validation failed",
  "error": {
    "code": "VALIDATION_FAILED",
    "detail": "Request validation failed",
    "violations": [ { "field": "password", "message": "size must be between 8 and 128" } ]
  },
  "timestamp": "2026-09-28T16:31:00.123Z"
}
```

Handlers (`GlobalExceptionHandler` in palpeer-common + `SecurityExceptionHandler` in palpeer-app, the latter at highest precedence):

| Exception | HTTP | `error.code` | envelope `message` |
|---|---|---|---|
| `PalpeerException` / `BusinessException` | the exception's status (BusinessException 2-arg ctor defaults to **422**; every call site in scope passes an explicit status) | exception code | exception message |
| `ResourceNotFoundException` | 404 | `RESOURCE_NOT_FOUND` | e.g. `"Wallet not found"` |
| `MethodArgumentNotValidException` (`@Valid` body) | 400 | `VALIDATION_FAILED` + `violations` | `"Validation failed"` |
| `MethodArgumentTypeMismatchException`, `MissingServletRequestParameterException` | 400 | `INVALID_PARAMETER` (`detail`: `"Invalid or missing request parameter: <name>"`) | `"Invalid request parameter"` |
| `HttpMessageNotReadableException` (malformed JSON, wrong type, unknown enum value in the body) — added in mobile Phase 12 | 400 | `MALFORMED_REQUEST` (`detail`: `"The request body is malformed or contains an invalid value"`, no parser details) | `"Malformed request body"` |
| `AccessDeniedException`, `AuthorizationDeniedException` (e.g. `@PreAuthorize` failing inside a controller) | 403 | `ACCESS_DENIED` | `"Access denied"` |
| any other `Exception` | 500 | `INTERNAL_ERROR` (`detail`: `"An unexpected error occurred"`) | `"Internal server error"` |

Gotchas the mobile app must handle (these all fall through to **500 `INTERNAL_ERROR`** because no dedicated handler exists):

- ~~Malformed JSON body or an unknown enum value in the body~~ — now 400 `MALFORMED_REQUEST` (see table above; verified live).
- **Missing `Idempotency-Key` header** on endpoints that declare it required (`MissingRequestHeaderException`). A present-but-blank header gives 400 `IDEMPOTENCY_KEY_REQUIRED` instead.
- Missing multipart part `file` on KYC uploads (`MissingServletRequestPartException`).
- Upload larger than the multipart limit (`MaxUploadSizeExceededException`) — expected 500.
- Wrong HTTP method / unsupported content type / unknown route (after authentication).
- SMTP failure while sending an OTP e-mail (`IllegalStateException("Email delivery failed")`) — registration, OTP resend and password-reset request return 500 and roll back.

### 1.3 Authentication and unauthenticated behaviour

`SecurityConfig` (palpeer-app): stateless, CSRF disabled, JWT filter before `UsernamePasswordAuthenticationFilter`, `@EnableMethodSecurity`.

Public (`permitAll`):

- `OPTIONS /**`
- `/actuator/health`, `/actuator/info`, `/v3/api-docs/**`, `/swagger-ui/**`, `/swagger-ui.html`
- `/ws`, `/ws/**` (WebSocket handshake; STOMP CONNECT is authenticated separately, see 3.13)
- `/api/v1/webhooks/**`
- `POST` only: `/api/v1/auth/register`, `/login`, `/logout`, `/refresh`, `/otp/verify`, `/otp/resend`, `/password-reset/request`, `/password-reset/confirm`

`/api/v1/admin/**` requires `ROLE_ADMIN`. **Everything else requires an authenticated user** (`anyRequest().authenticated()`), including currencies/exchange rates and active promotions.

Header: `Authorization: Bearer <accessToken>`. The filter only accepts tokens whose claim `token_type` = `access`; refresh tokens are ignored as bearer tokens. Invalid/expired/disabled-user tokens are silently dropped (request continues as anonymous).

**Unauthenticated/expired token response: HTTP 403 with an empty body** (no `AuthenticationEntryPoint` is configured, so Spring Security's default `Http403ForbiddenEntryPoint` is used — not 401, not the envelope). The app should treat "403 with empty body" on a protected call as "access token invalid → call `/auth/refresh`". A 403 **with** envelope `ACCESS_DENIED` means an authorization failure, not an expired token.

`@PreAuthorize` in non-admin controllers (admin-only, not for mobile): `POST /api/v1/currencies` (`currencies:write`), `POST /api/v1/exchange-rates` (`rates:write`), `POST /api/v1/promotions` (`promotions:write`).

The JWT filter checks only `User.enabled`. It does **not** check `UserStatus`, e-mail/phone verification, KYC status or PIN setup; none of these gate any endpoint.

### 1.4 Pagination shapes

Two shapes exist.

**A. Spring Data `Page<T>` (serialized as-is, Spring Data 3.3 default).** Used by: `GET /wallets/{walletId}/transactions`, `GET /chat/rooms/{roomId}/messages`, `GET /cards/{cardId}/transactions`, `GET /notifications`, `GET /promotions/bonuses/mine`.

Query params (Spring `Pageable`): `page` (0-based, default 0), `size` (default per endpoint via `@PageableDefault`; Spring max 2000), `sort` (e.g. `sort=createdAt,desc`; repository methods already order by date desc).

```json
{
  "content": [ … ],
  "pageable": { "pageNumber": 0, "pageSize": 20, "sort": { "empty": true, "sorted": false, "unsorted": true }, "offset": 0, "paged": true, "unpaged": false },
  "last": true, "totalPages": 1, "totalElements": 3, "size": 20, "number": 0,
  "sort": { "empty": true, "sorted": false, "unsorted": true },
  "first": true, "numberOfElements": 3, "empty": false
}
```

Rely only on `content`, `totalElements`, `totalPages`, `number`, `size`, `first`, `last`, `empty`. (No `@EnableSpringDataWebSupport(pageSerializationMode = VIA_DTO)` is configured; Spring logs a warning that this raw shape is not guaranteed stable.)

**B. `TransactionPageResponse`** (only `GET /transactions/history`): `{ items: TransactionItemResponse[], page: int, size: int, totalElements: long, totalPages: int }`. `page` is 0-based; `size` is clamped to 1..100.

All other list endpoints return plain JSON arrays (no pagination).

### 1.5 JSON serialization: money, dates, ids, enums

No custom Jackson configuration exists (no `spring.jackson.*` properties, no `ObjectMapper`/`Jackson2ObjectMapperBuilderCustomizer` bean, no `@JsonFormat` on DTOs). Spring Boot defaults apply:

- **`BigDecimal` → JSON number** (not string). Written via `BigDecimal.toString()`:
  - Values loaded from the DB have **scale 12** (columns are `numeric(28,12)`), e.g. balances serialize as `1500.000000000000`.
  - Values in the response to a create call echo the request's scale (e.g. `100.5`) because the entity isn't reloaded.
  - Very small values can be written in scientific notation (e.g. `1.00000E-7`) since `WRITE_BIGDECIMAL_AS_PLAIN` is off.
  - Recommendation: parse money with a lossless JSON number strategy (or a decimal library) and format with the currency's `precision`.
- Request bodies accept numbers (or numeric strings, which Jackson coerces) for `BigDecimal` fields.
- **Currency codes**: plain strings, `@Size(min = 3, max = 10)` where validated, upper-cased server-side (`trim().toUpperCase()`). Codes must exist in the `currencies` table (no seed data in migrations; created by admin). Rails are hard-wired to `CAD` (Apaylo) and `NGN` (Kuda).
- **Rate precision**: `numeric(28,12)`; the inverse rate is computed to 12 decimal places, `HALF_EVEN`. FX amounts are scaled to each currency's `precision` (from `GET /currencies`) with `HALF_EVEN`.
- **`Instant`** → ISO-8601 UTC string (e.g. `2026-09-28T16:31:00.123456Z`). Query params typed `Instant` use `@DateTimeFormat(iso = DATE_TIME)`, e.g. `2026-09-01T00:00:00Z`.
- **`UUID`** → string.
- **Enums** → their exact `name()` string; path/query enum params are **case-sensitive**.

### 1.6 Idempotency-Key header

Search result for `Idempotency`: required HTTP header `Idempotency-Key` (`@RequestHeader("Idempotency-Key")`, required) on exactly three endpoints:

| Endpoint | Replay rule | Conflict code |
|---|---|---|
| `POST /api/v1/funding` | same key + same user + same `walletId` + same `amount` → returns the original transaction | `FUNDING_IDEMPOTENCY_CONFLICT` (409) |
| `POST /api/v1/withdrawals` | same key + same user + same `walletId` + same `amount` | `WITHDRAWAL_IDEMPOTENCY_CONFLICT` (409) |
| `POST /api/v1/exchange/execute` | same key + same user + same `quoteId` | `EXCHANGE_IDEMPOTENCY_CONFLICT` (409) |

Key column length is 100 chars; keys are **globally unique** across users (DB unique constraint), so use a UUID v4 per user action. Missing header → 500 (see 1.2); blank header → 400 `IDEMPOTENCY_KEY_REQUIRED`. Chat messages use an optional body field `clientMessageId` for replay de-duplication (not a header).

### 1.7 Transaction PIN usage

Search result for PIN usage: `PinService` is referenced **only** by `SecurityController`. **No endpoint requires a PIN** — not exchange, withdrawal, funding, P2P, negotiation, or cards. There is no PIN header and no PIN body field on money-movement DTOs. If the app wants a PIN gate, it can call `POST /api/v1/security/pin/verify` client-side before a money action, but the server does not enforce it (see security issues).

---

## 2. Auth token model

Sources: `JwtService`, `AuthService`, `AuthProperties`, `application.yml`, `application-dev.yml`, `.env`.

| Item | Verified value |
|---|---|
| Algorithm | HMAC (jjwt `Keys.hmacShaKeyFor(secret)`), issuer `palpeer` (required on parse) |
| Access token TTL | `JWT_ACCESS_TTL`, default **15m** |
| Refresh token TTL | `JWT_REFRESH_TTL`, default **14d** |
| Access claims | `sub` = userId (UUID), `email`, `token_type` = `access`, `iss`, `iat`, `exp` |
| Refresh claims | `sub` = userId, `token_type` = `refresh`, `jti` (random UUID), `iss`, `iat`, `exp` |
| Refresh storage | SHA-256 hash stored in `refresh_tokens` (one row per session) |
| Rotation | **Yes.** `POST /auth/refresh` revokes the presented refresh token (`replacedByHash` set) and issues a new access + refresh pair. Re-using an old refresh token → 401 `INVALID_REFRESH_TOKEN`. There is no reuse-detection that revokes the whole family. |
| Login returns | `AuthTokensResponse { userId, accessToken, refreshToken, tokenType: "Bearer" }` — no expiry fields; decode `exp` from the JWT if needed. |
| Logout | `POST /auth/logout { refreshToken }` revokes that refresh token only (always 200, even if unknown). The access token stays valid until it expires (no blacklist). |
| Password change / reset | Revokes **all** refresh tokens of the user. Access tokens remain valid until expiry. |
| Sessions | One session = one non-revoked, non-expired refresh token. |

**Unverified accounts:** registration sets `status=PENDING_VERIFICATION`, `enabled=true`, `emailVerified=false`, `phoneVerified=false`. **Login does not check verification or status** (code comment: `CONTRACT_PENDING: whether unverified users may obtain tokens`). Login only fails for:

- unknown e-mail or wrong password → 401 `INVALID_CREDENTIALS` (`"Invalid credentials"`)
- `enabled=false` → 403 `USER_DISABLED` (`"User account is disabled"`)

Status becomes `ACTIVE` only after **both** `EMAIL_VERIFICATION` and `PHONE_VERIFICATION` OTPs are verified. Nothing else in the backend reads `UserStatus` or the verified flags for customer endpoints. No endpoint returns the user's own `status`/`emailVerified`/`phoneVerified` after registration (see section 11).

**OTP generation and delivery:**

- 6 numeric digits (`OTP_LENGTH`), `SecureRandom`, SHA-256 hashed at rest, TTL **10 minutes** (`OTP_TTL`), max **5** wrong attempts per challenge (`OTP_MAX_ATTEMPTS`).
- Registration issues two challenges: `EMAIL_VERIFICATION` via `EMAIL` and `PHONE_VERIFICATION` via `SMS`.
- `EMAIL` channel: sent by `EmailSender` (SendPulse REST when configured, else SMTP).
- `SMS` channel: **placeholder only** — logs `OTP SMS placeholder [...]` without the code; no SMS provider exists.
- Dev: `palpeer.security.otp.log-code=true` in `application-dev.yml` and `OTP_LOG_CODE=true` in `.env` → server logs `DEV OTP [channel=…, destination=…, purpose=…, code=123456]` at WARN. **No fixed/master code exists.** Note the log line is written after the e-mail send, so if SMTP fails the request 500s and the code is never logged.
- Verify/resend pick the **latest unconsumed challenge for the purpose**; the request `channel` must equal that challenge's channel (`OTP_CHANNEL_MISMATCH`).

**Password rules:** `@NotBlank @Size(min = 8, max = 128)` on register, reset-confirm and change. No complexity rules. Hashing: BCrypt. Login e-mail is matched case-insensitively and is not format-validated on login.

---

## 3. Endpoints

Notation: "Auth: Public" = in the `permitAll` list; "Auth: Bearer" = authenticated user required. Unless noted, success status is **200**.

### 3.1 Auth `/api/v1/auth`

#### `POST /api/v1/auth/register` — VERIFIED
- Auth: Public. Success: **201**, message `"Registered"`.
- Request `RegisterRequest`:

| Field | Type | Constraints |
|---|---|---|
| `email` | string | `@NotBlank @Email @Size(max = 320)`; stored lower-cased, trimmed |
| `phone` | string | `@NotBlank @Size(max = 32)`; trimmed; no format validation |
| `password` | string | `@NotBlank @Size(min = 8, max = 128)` |

- Response `data` `RegisterResponse`: `userId` UUID, `email` string, `phone` string, `status` string (`"PENDING_VERIFICATION"`), `message` string (`"Registration successful. OTP verification required."`).
- Side effects: sends e-mail OTP (`EMAIL_VERIFICATION`/`EMAIL`) and SMS placeholder OTP (`PHONE_VERIFICATION`/`SMS`).
- Errors: 409 `EMAIL_ALREADY_REGISTERED`, 409 `PHONE_ALREADY_REGISTERED` (exact string match), 500 if SMTP fails.

#### `POST /api/v1/auth/login` — VERIFIED
- Auth: Public. Success: 200, no message.
- Request `LoginRequest`: `email` string `@NotBlank` (email **or** phone number); `password` string `@NotBlank`.
- Response `data` `AuthTokensResponse`: `userId` UUID, `accessToken` string, `refreshToken` string, `tokenType` string (`"Bearer"`).
- Errors: 401 `INVALID_CREDENTIALS`, 403 `USER_DISABLED`, 400 `PASSWORD_LOGIN_UNAVAILABLE` (Google-only account). Unverified users **can** log in.

#### `POST /api/v1/auth/google` — VERIFIED
- Auth: Public. Success: 200, no message.
- Request `GoogleAuthRequest`: `idToken` string `@NotBlank` (Google Sign-In ID token).
- Response `data`: `AuthTokensResponse`. Creates a user on first use (email verified, no password/phone) or links Google to an existing email account.
- Requires `GOOGLE_CLIENT_IDS` (comma-separated OAuth client IDs) on the server.
- Errors: 503 `GOOGLE_AUTH_DISABLED`, 401 `INVALID_GOOGLE_TOKEN`, 401 `GOOGLE_EMAIL_UNVERIFIED`, 409 `GOOGLE_ACCOUNT_CONFLICT`, 403 `USER_DISABLED`.

#### `POST /api/v1/auth/logout` — VERIFIED
- Auth: Public (no bearer needed). Success: 200, message `"Logged out"`, no `data`.
- Request `LogoutRequest`: `refreshToken` string `@NotBlank`.
- Errors: none besides validation (unknown token is ignored).

#### `POST /api/v1/auth/refresh` — VERIFIED
- Auth: Public. Success: 200, no message.
- Request `RefreshTokenRequest`: `refreshToken` string `@NotBlank`.
- Response `data`: `AuthTokensResponse` (new pair; old refresh token revoked).
- Errors: 401 `INVALID_REFRESH_TOKEN` (not a refresh JWT / bad signature / revoked / unknown), 401 `REFRESH_TOKEN_EXPIRED`, 401 `USER_NOT_FOUND`, 403 `USER_DISABLED`.

#### `POST /api/v1/auth/otp/verify` — VERIFIED
- Auth: Public. Success: 200, message `"OTP verified"`, no `data`.
- Request `OtpVerifyRequest`:

| Field | Type | Constraints |
|---|---|---|
| `email` | string | `@NotBlank` (identifies the user even for phone OTP) |
| `purpose` | `OtpPurpose` | `@NotNull`; `EMAIL_VERIFICATION` or `PHONE_VERIFICATION` (`PASSWORD_RESET` rejected) |
| `channel` | `OtpChannel` | `@NotNull`; must match the latest challenge's channel |
| `code` | string | `@NotBlank` |

- Errors: 400 `OTP_PURPOSE_INVALID` (purpose `PASSWORD_RESET`), 404 `USER_NOT_FOUND`, 400 `OTP_NOT_FOUND`, 400 `OTP_CHANNEL_MISMATCH`, 400 `OTP_EXPIRED`, 400 `OTP_MAX_ATTEMPTS`, 400 `OTP_INVALID`.

#### `POST /api/v1/auth/otp/resend` — VERIFIED
- Auth: Public. Success: 200, message `"OTP resent"`, no `data`.
- Request `OtpResendRequest`: `email` string `@NotBlank`; `purpose` `OtpPurpose` `@NotNull`; `channel` `OtpChannel` `@NotNull`.
- Behaviour: issues a new challenge on the requested channel (any purpose/channel combination is accepted). For `PASSWORD_RESET`, unknown e-mails are silently ignored. Note `password-reset/confirm` only accepts an `EMAIL` challenge, so resend password reset with `channel: "EMAIL"`.
- Errors: 404 `USER_NOT_FOUND` (non-password-reset purposes), 500 on SMTP failure. No rate limit.

#### `POST /api/v1/auth/password-reset/request` — VERIFIED
- Auth: Public. Success: 200, message `"If the account exists, a reset OTP has been sent"`, no `data`.
- Request `PasswordResetRequestDto`: `email` string `@NotBlank @Email`.
- Behaviour: issues `PASSWORD_RESET` OTP via `EMAIL` if the account exists; always 200 otherwise.

#### `POST /api/v1/auth/password-reset/confirm` — VERIFIED
- Auth: Public. Success: 200, message `"Password reset successful"`, no `data`.
- Request `PasswordResetConfirmRequest`: `email` string `@NotBlank @Email`; `code` string `@NotBlank`; `newPassword` string `@NotBlank @Size(min = 8, max = 128)`.
- Side effects: revokes all refresh tokens.
- Errors: 404 `USER_NOT_FOUND`, 400 `OTP_NOT_FOUND`, 400 `OTP_CHANNEL_MISMATCH`, 400 `OTP_EXPIRED`, 400 `OTP_MAX_ATTEMPTS`, 400 `OTP_INVALID`.

#### `POST /api/v1/auth/password/change` — VERIFIED
- Auth: Bearer. Success: 200, message `"Password changed"`, no `data`.
- Request `ChangePasswordRequest`: `currentPassword` string `@NotBlank`; `newPassword` string `@NotBlank @Size(min = 8, max = 128)`.
- Side effects: revokes all refresh tokens (the app must log in again once the access token expires).
- Errors: 404 `USER_NOT_FOUND`, 400 `INVALID_CURRENT_PASSWORD`.

#### `GET /api/v1/auth/sessions` — VERIFIED
- Auth: Bearer. Optional header `X-Refresh-Token: <refreshToken>` to flag the current session.
- Response `data`: array of `SessionResponse` { `id` UUID, `createdAt` Instant, `expiresAt` Instant, `current` boolean }. Ordered newest first. No device/IP/user-agent info.

#### `POST /api/v1/auth/sessions/{id}/revoke` — VERIFIED
- Auth: Bearer. Path `id` UUID (session id). Success: 200, message `"Session revoked"`, no `data`.
- Errors: 404 `RESOURCE_NOT_FOUND` (`"Session not found"`).

#### `POST /api/v1/auth/sessions/revoke-all` — VERIFIED
- Auth: Bearer. No body. Success: 200, message `"All sessions revoked"`, no `data`. Includes the caller's own refresh token.

Live-checked in mobile Phase 13 (26 checks): the session list has exactly those four fields, newest first; without `X-Refresh-Token` no session is `current`; another user's session id → 404; revoking an already-revoked own session → 200 again; a revoked session's refresh → 401 while its access token keeps working until expiry; password change with a wrong current password → 400 `INVALID_CURRENT_PASSWORD`, too-short new password → 400 `VALIDATION_FAILED` (violation on `newPassword`); after a change, the caller's refresh token → 401, the old password → 401, `POST /auth/logout` with the revoked token → 200. Mobile use: `services/auth/accountCommands.ts` (password, outside RTK Query) and `authApi` `getSessions` / `revokeSession` / `revokeAllSessions`.

### 3.2 Profile `/api/v1/profiles`

The profile aggregate has **no attributes** yet (`CONTRACT_PENDING (P2-01)`): only an id and a user link.

#### `POST /api/v1/profiles` — VERIFIED
- Auth: Bearer. Success: **201**, message `"Profile created"`.
- Request `CreateProfileRequest`: empty record — send `{}`.
- Response `data` `ProfileResponse`: `id` UUID, `userId` UUID.
- Errors: 404 `RESOURCE_NOT_FOUND` (`"User not found"`), 409 `PROFILE_EXISTS`.

#### `GET /api/v1/profiles/me` — VERIFIED
- Auth: Bearer. Response `data`: `ProfileResponse` { `id`, `userId` }.
- Errors: 404 `RESOURCE_NOT_FOUND` (`"Profile not found"`).

### 3.3 KYC `/api/v1/kyc`

#### `POST /api/v1/kyc/documents` (multipart/form-data) — VERIFIED
- Auth: Bearer. Consumes `multipart/form-data`. Success: **201**, message `"Document uploaded"`.
- Parts/fields: `documentType` (text field, `@RequestParam`, required; free text, trimmed + upper-cased), `file` (file part, `@RequestPart`, required).
- Response `data` `KycDocumentResponse`: `id` UUID, `kycCaseId` UUID, `documentType` string, `contentType` string, `originalFilename` string, `sizeBytes` long.
- Side effects: creates the KYC case if missing; status `NOT_STARTED`/`REJECTED` → `IN_PROGRESS` (clears `rejectionReason`).
- Errors: 400 `FILE_REQUIRED` (empty file), 400 `DOCUMENT_TYPE_REQUIRED` (blank), 400 `INVALID_PARAMETER` (missing `documentType`), 409 `KYC_UPLOAD_NOT_ALLOWED` (status `SUBMITTED`, `UNDER_REVIEW` or `APPROVED`), 500 `STORAGE_WRITE_FAILED`, 500 (missing `file` part or file too large).

#### `POST /api/v1/kyc/selfie` (multipart/form-data) — VERIFIED
- Auth: Bearer. Success: **201**, message `"Selfie uploaded"`.
- Parts: `file` (required).
- Response `data` `SelfieResponse`: `id` UUID, `kycCaseId` UUID, `contentType` string, `originalFilename` string, `sizeBytes` long.
- Errors: same as documents (minus `DOCUMENT_TYPE_REQUIRED`).

#### `GET /api/v1/kyc/status` — VERIFIED
- Auth: Bearer. Response `data` `KycStatusResponse`: `caseId` UUID|null, `userId` UUID, `status` `KycStatus`, `rejectionReason` string|null, `createdAt` Instant|null, `updatedAt` Instant|null. When no case exists: `caseId`/`createdAt`/`updatedAt` null and `status: "NOT_STARTED"`.

#### `GET /api/v1/kyc/progress` — VERIFIED
- Auth: Bearer. Response `data` `KycProgressResponse`: `caseId` UUID|null, `status` `KycStatus`, `hasDocument` boolean, `documentCount` long, `hasSelfie` boolean, `selfieCount` long. No case → `{ caseId: null, status: "NOT_STARTED", hasDocument: false, documentCount: 0, hasSelfie: false, selfieCount: 0 }`.

#### `POST /api/v1/kyc/verification/start` — VERIFIED
- Auth: Bearer. Success: **202**, message `"Verification submitted to ComplyCube"`.
- Request `StartKycVerificationRequest`:

| Field | Type | Constraints |
|---|---|---|
| `firstName` | string | `@NotBlank @Size(max = 80)` |
| `lastName` | string | `@NotBlank @Size(max = 80)` |
| `dateOfBirth` | string | `@Size(max = 10)`, optional (sent to ComplyCube as `dob`; use `YYYY-MM-DD`) |
| `issuingCountry` | string | `@Size(min = 2, max = 2)`, optional (ISO-3166 alpha-2, upper-cased) |

- Behaviour: uses the **latest** uploaded document (front side only) and the latest selfie if any (identity check) else a document check. Case → `UNDER_REVIEW`. Final result arrives via the ComplyCube webhook.
- Response `data` `KycVerificationResponse`: `caseId` UUID, `status` `KycStatus`, `providerName` string (`"COMPLYCUBE"`), `providerClientId` string, `providerCheckId` string.
- Errors: 503 `KYC_PROVIDER_DISABLED` (default: `COMPLYCUBE_ENABLED=false` in `.env`), 404 `RESOURCE_NOT_FOUND`, 409 `KYC_UPLOAD_NOT_ALLOWED`, 400 `KYC_DOCUMENT_REQUIRED`, 502 `COMPLYCUBE_ERROR`, 500 `KYC_STORAGE_READ_FAILED`.
- Without ComplyCube, KYC only progresses through admin review (`SUBMITTED`/`UNDER_REVIEW`/`APPROVED`/`REJECTED`); the customer API has **no "submit for review" endpoint**, so a local-only case stays `IN_PROGRESS` until an admin acts.

### 3.4 Security `/api/v1/security`

All endpoints: Auth Bearer.

#### `GET /api/v1/security/pin` — VERIFIED
- Response `data` `PinStatusResponse`: `pinSet` boolean; `lockedUntil` ISO instant or null (set only while the PIN is locked).

#### `POST /api/v1/security/pin` — VERIFIED
- Success: **201**, message `"PIN set"`, no `data`.
- Request `SetPinRequest`: `pin` string `@NotBlank @Pattern(regexp = "\\d{4,8}", message = "PIN must be 4-8 digits (provisional P3-01)")`.
- Errors: 409 `PIN_ALREADY_SET`.

#### `PUT /api/v1/security/pin` — VERIFIED
- Success: 200, message `"PIN changed"`, no `data`.
- Request `ChangePinRequest`: `currentPin` string `@NotBlank`; `newPin` string `@NotBlank @Pattern("\\d{4,8}")`.
- Errors: 404 `RESOURCE_NOT_FOUND` (`"PIN not set"`), 401 `PIN_INVALID` (`"Current PIN is invalid"`).

#### `POST /api/v1/security/pin/reset` — VERIFIED
- Success: 200, message `"PIN reset"`, no `data`. Reset factor = security-question answers (no OTP).
- Request `ResetPinRequest`: `answers` array of `SecurityAnswerRequest` `@NotEmpty @Valid`; `newPin` string `@NotBlank @Pattern("\\d{4,8}")`.
  - `SecurityAnswerRequest`: `questionKey` string `@NotBlank`; `answer` string `@NotBlank` (compared trimmed + lower-cased).
- **All** configured questions must be answered; unknown keys rejected.
- Errors: 409 `SECURITY_QUESTIONS_REQUIRED`, 409 `PIN_NOT_SET`, 409 `SECURITY_QUESTIONS_NOT_SET`, 400 `SECURITY_ANSWER_MISSING`, 401 `SECURITY_ANSWER_INVALID`, 400 `SECURITY_ANSWER_UNKNOWN`.

#### `POST /api/v1/security/pin/verify` — VERIFIED
- Success: 200, message `"PIN verified"`, no `data`.
- Request `VerifyPinRequest`: `pin` string `@NotBlank`.
- Errors: 404 `RESOURCE_NOT_FOUND` (`"PIN not set"`), 401 `PIN_INVALID` (`"PIN is invalid"`), 423 `PIN_LOCKED` (`"Too many incorrect attempts. Try again later."`).
- Lockout (V25): 5 consecutive failures across verify, change (`currentPin`) and reset (security answers) lock the PIN for 15 minutes; the attempt that hits the limit already returns 423. Any success resets the counter. Values are configurable (`palpeer.security.pin.*`) and provisional (P3-01).

#### `PUT /api/v1/security/questions` — VERIFIED
- Success: 200, message `"Security questions saved"`. **Replaces** all existing questions.
- Request `SetSecurityQuestionsRequest`: `questions` array of `SecurityQuestionInput` `@NotEmpty @Valid`, minimum **2** items (service rule).
  - `SecurityQuestionInput`: `questionKey` string `@NotBlank @Size(max = 120)` (stored upper-cased); `questionText` string `@NotBlank @Size(max = 500)`; `answer` string `@NotBlank @Size(min = 1, max = 200)` (stored BCrypt of trimmed lower-cased value).
- Response `data`: array of `SecurityQuestionResponse` { `id` UUID, `questionKey` string, `questionText` string }.
- Errors: 400 `SECURITY_QUESTIONS_MIN`, 400 `SECURITY_QUESTIONS_DUPLICATE`.

#### `GET /api/v1/security/questions` — VERIFIED
- Response `data`: array of `SecurityQuestionResponse` (the **user's own** configured questions, never answers). This is **not** a catalogue of selectable questions (see section 8).

#### `POST /api/v1/security/devices` — VERIFIED
- Success: **201**, message `"Device registered"`.
- Request `RegisterDeviceRequest`:

| Field | Type | Constraints |
|---|---|---|
| `deviceIdentifier` | string | `@NotBlank @Size(max = 255)`; unique per user |
| `platform` | string | `@Size(max = 40)`, optional, free text |
| `deviceName` | string | `@Size(max = 120)`, optional |
| `biometricCredential` | string | `@NotBlank @Size(max = 2000)`; opaque, stored, never returned |

- Response `data` `DeviceResponse`: `id` UUID, `deviceIdentifier` string, `platform` string|null, `deviceName` string|null, `enabled` boolean, `lastUsedAt` Instant|null (never set by any code path).
- Errors: 409 `DEVICE_EXISTS`.

#### `GET /api/v1/security/devices` — VERIFIED
- Response `data`: array of `DeviceResponse`.

#### `POST /api/v1/security/devices/{deviceId}/disable` — VERIFIED
- Path `deviceId` UUID. Response `data`: `DeviceResponse` (`enabled: false`). Errors: 404 `RESOURCE_NOT_FOUND` (`"Device not found"`).

#### `POST /api/v1/security/devices/{deviceId}/enable` — VERIFIED
- Path `deviceId` UUID. Response `data`: `DeviceResponse` (`enabled: true`). Errors: 404.

#### `DELETE /api/v1/security/devices/{deviceId}` — VERIFIED
- Path `deviceId` UUID. Success: 200, message `"Device deleted"`, no `data`. Errors: 404.

### 3.5 Wallets `/api/v1/wallets`

No wallet status enum exists. One wallet per user per currency. Balances change only through ledger postings.

#### `POST /api/v1/wallets` — VERIFIED
- Auth: Bearer. Success: **201**, message `"Wallet created"`.
- Request `CreateWalletRequest`: `currencyCode` string `@NotBlank @Size(min = 3, max = 10)` (upper-cased; must exist).
- Response `data` `WalletResponse`: `id` UUID, `userId` UUID, `currencyCode` string, `availableBalance` BigDecimal, `pendingBalance` BigDecimal.
- Errors: 404 `RESOURCE_NOT_FOUND` (`"Currency not found: XXX"`), 409 `WALLET_EXISTS`.

#### `GET /api/v1/wallets` — VERIFIED
- Auth: Bearer. Response `data`: array of `WalletResponse`, ordered by `currencyCode` asc.

#### `GET /api/v1/wallets/{walletId}` — VERIFIED
- Auth: Bearer. Path `walletId` UUID. Response `data`: `WalletResponse`. Errors: 404 (`"Wallet not found"`, also for other users' wallets).

#### `GET /api/v1/wallets/{walletId}/transactions` — VERIFIED
- Auth: Bearer. Path `walletId` UUID. Query: `page`, `size` (default **20**), `sort`.
- Response `data`: `Page<LedgerTransactionResponse>` (shape A), newest first.
  - `LedgerTransactionResponse`: `id` UUID, `walletId` UUID, `entryType` `LedgerEntryType`, `amount` BigDecimal, `currencyCode` string, `availableBalanceAfter` BigDecimal, `pendingBalanceAfter` BigDecimal, `referenceType` string (`FUNDING`, `FUNDING_REVERSAL`, `WITHDRAWAL`, `WITHDRAWAL_REVERSAL`, `EXCHANGE`), `referenceId` string (source transaction UUID), `description` string (e.g. `"Funding credit"`, `"Withdrawal hold"`, `"Instant exchange debit"`), `createdAt` Instant.
- Errors: 404.

### 3.6 Funding `/api/v1/funding`

#### `POST /api/v1/funding` — VERIFIED
- Auth: Bearer. **Header `Idempotency-Key` required.** Success: **201**, message `"Funding initiated"`.
- Request `CreateFundingRequest`:

| Field | Type | Constraints |
|---|---|---|
| `walletId` | UUID | `@NotNull`; must belong to the caller |
| `amount` | BigDecimal | `@NotNull @DecimalMin(value = "0", inclusive = false)` |
| `providerReference` | string | optional; overwritten when a rail is enabled |

- Response `data` `FundingTransactionResponse`: `id` UUID, `walletId` UUID, `amount` BigDecimal, `currencyCode` string, `status` `MoneyMovementStatus`, `idempotencyKey` string, `ledgerEntryId` UUID|null, `reversalLedgerEntryId` UUID|null, `failureReason` string|null, `providerName` string|null (`APAYLO`/`KUDA`), `providerReference` string|null, `fundingInstructions` string|null (plain-text), `paymentDetails` object|null while `INITIATED`/`PENDING`/`PROCESSING` — Kuda `BANK_TRANSFER` (`accountNumber`, bank, …) or Apaylo `INTERAC_INSTANT` (`accountName` = searchable payee, `trackingReference`, `interacEmail`, `aplReference`, …), `createdAt` Instant.
- Status after initiate: `PENDING` when a rail for the wallet currency is enabled (external settlement awaited), otherwise `INITIATED` with no instructions. See section 5.
- Errors: 400 `IDEMPOTENCY_KEY_REQUIRED` (blank), 500 (header missing), 404 (`"Wallet not found"`), 409 `FUNDING_IDEMPOTENCY_CONFLICT`, 502 `APAYLO_ERROR` / `KUDA_ERROR` / `KUDA_AUTH_FAILED`, 503 `PAYMENT_RAIL_UNAVAILABLE`.

#### `GET /api/v1/funding/{fundingId}` — VERIFIED
- Auth: Bearer. Path `fundingId` UUID. Response `data`: `FundingTransactionResponse`. Errors: 404 (`"Funding transaction not found"`). Use this to poll `PENDING` → `SUCCESS`/`FAILED`.

#### `POST /api/v1/funding/{fundingId}/process` — VERIFIED — NOT FOR MOBILE
- Auth: **operator only** — `ROLE_ADMIN` + `payments:operate` (V25); customers get 403 `ACCESS_DENIED`. Acts on any funding by id; the operator is audited (`FUNDING_OPERATOR_PROCESS`). Moves `INITIATED|PENDING` → `PROCESSING` → `SUCCESS` and posts a ledger `CREDIT`. Idempotent on `SUCCESS`.
- Errors: 403, 404, 409 `FUNDING_INVALID_STATE`.

#### `POST /api/v1/funding/{fundingId}/fail` — VERIFIED — NOT FOR MOBILE
- Auth: operator only (`ROLE_ADMIN` + `payments:operate`). Optional body `FailMovementRequest` { `reason` string }. `INITIATED|PENDING|PROCESSING` → `FAILED`. Errors: 403, 404, 409 `FUNDING_INVALID_STATE`.

#### `POST /api/v1/funding/{fundingId}/reverse` — VERIFIED — NOT FOR MOBILE
- Auth: operator only (`ROLE_ADMIN` + `payments:operate`). `SUCCESS` → `REVERSED` with ledger `DEBIT`. Errors: 404, 409 `FUNDING_INVALID_STATE`, 422 `INSUFFICIENT_AVAILABLE_BALANCE`.

### 3.7 Withdrawals `/api/v1/withdrawals`

#### `POST /api/v1/withdrawals` — VERIFIED
- Auth: Bearer. **Header `Idempotency-Key` required.** No PIN. Success: **201**, message `"Withdrawal initiated"`.
- Request `CreateWithdrawalRequest`:

| Field | Type | Constraints |
|---|---|---|
| `walletId` | UUID | `@NotNull`; must belong to the caller |
| `amount` | BigDecimal | `@NotNull @DecimalMin(value = "0", inclusive = false)` |
| `destinationReference` | string | optional in DTO (DB max 120). **CAD**: Interac e-mail, Interac phone, or EFT `institution:transit:account` (regex `\d{3}[:|;-]\d{5}[:|;-]\d+`). **NGN**: `bankCode:accountNumber` (separators `:`, `|`, `;`) — required when Kuda is enabled. |

- Behaviour: places a ledger `HOLD` (available → pending) immediately, status `PENDING`; if a rail is enabled it calls the provider (Apaylo Interac/EFT, Kuda name-enquiry + `SINGLE_FUND_TRANSFER`) and stays `PENDING` until webhook.
- Response `data` `WithdrawalTransactionResponse`: `id` UUID, `walletId` UUID, `amount` BigDecimal, `currencyCode` string, `status` `MoneyMovementStatus`, `idempotencyKey` string, `holdLedgerEntryId` UUID|null, `debitLedgerEntryId` UUID|null, `releaseLedgerEntryId` UUID|null, `reversalLedgerEntryId` UUID|null, `failureReason` string|null, `destinationReference` string|null, `providerName` string|null, `providerReference` string|null, `createdAt` Instant.
- Errors: 400 `IDEMPOTENCY_KEY_REQUIRED`, 500 (header missing), 404 (`"Wallet not found"`), 409 `WITHDRAWAL_IDEMPOTENCY_CONFLICT`, **422 `INSUFFICIENT_AVAILABLE_BALANCE`** (the insufficient-funds code; there is no `INSUFFICIENT_FUNDS` code), 400 `APAYLO_DESTINATION_INVALID`, 400 `KUDA_DESTINATION_REQUIRED`, 400 `KUDA_DESTINATION_INVALID`, 502 `KUDA_NAME_ENQUIRY_FAILED` / `APAYLO_ERROR` / `KUDA_ERROR`, 503 `PAYMENT_RAIL_UNAVAILABLE`.

#### `GET /api/v1/withdrawals/{withdrawalId}` — VERIFIED
- Auth: Bearer. Path `withdrawalId` UUID. Response `data`: `WithdrawalTransactionResponse`. Errors: 404 (`"Withdrawal transaction not found"`).

#### `POST /api/v1/withdrawals/{withdrawalId}/process` — VERIFIED — NOT FOR MOBILE
- Auth: operator only (`ROLE_ADMIN` + `payments:operate`, V25). `RELEASE` + `DEBIT`, status `SUCCESS`. Errors: 403, 404, 409 `WITHDRAWAL_INVALID_STATE`.

#### `POST /api/v1/withdrawals/{withdrawalId}/fail` — VERIFIED — NOT FOR MOBILE
- Auth: operator only. Optional body `FailMovementRequest` { `reason` }. Releases the hold, status `FAILED`. Errors: 403, 404, 409 `WITHDRAWAL_INVALID_STATE`.

#### `POST /api/v1/withdrawals/{withdrawalId}/reverse` — VERIFIED — NOT FOR MOBILE
- Auth: operator only. `SUCCESS` → `REVERSED` with ledger `CREDIT`. Errors: 403, 404, 409 `WITHDRAWAL_INVALID_STATE`.

### 3.8 Currencies and exchange rates `/api/v1`

All require Bearer (not public).

#### `GET /api/v1/currencies` — VERIFIED
- Response `data`: array of `CurrencyResponse` { `id` UUID, `code` string, `symbol` string, `precision` int (decimal places) }.

#### `GET /api/v1/currencies/{code}` — VERIFIED
- Path `code` string (case-insensitive). Response `data`: `CurrencyResponse`. Errors: 404 (`"Currency not found: XXX"`).

#### `GET /api/v1/exchange-rates/latest` — VERIFIED
- Query: `base` string (required), `quote` string (required), `asOf` Instant ISO date-time (optional, default now).
- Response `data` `ExchangeRateResponse`: `id` UUID, `baseCurrencyCode` string, `quoteCurrencyCode` string, `buyRate` BigDecimal, `sellRate` BigDecimal, `effectiveDate` Instant.
- Errors: 400 `INVALID_PARAMETER` (missing `base`/`quote`), 404 (`"No exchange rate for X/Y"`). Only the exact direction is looked up (no inversion here).

#### `GET /api/v1/public/instant-rates` — VERIFIED
- Auth: Public. Latest InstantEX (admin-published) rate for every pair.
- Response `data`: array of `ExchangeRateResponse`, ordered by base then quote.

#### `GET /api/v1/public/p2p-rates` — VERIFIED
- Auth: Public. Open P2P request rates without owner id or notes.
- Response `data`: array of `PublicP2PRateResponse` (`id`, `side`, `baseCurrencyCode`, `quoteCurrencyCode`, `amount`, `rate`, `expiresAt`, `createdAt`).

#### `GET /api/v1/exchange-rates` — VERIFIED
- Query: `base` (required), `quote` (required). Response `data`: array of `ExchangeRateResponse`, newest `effectiveDate` first (includes future-dated rows). No pagination.

#### Admin-authority endpoints in this controller (not for mobile)
- `POST /api/v1/currencies` (`@PreAuthorize("hasAuthority('currencies:write')")`), body `CreateCurrencyRequest` { `code` `@NotBlank @Size(min=3,max=10)`, `symbol` `@NotBlank @Size(max=10)`, `precision` int `@Min(0) @Max(18)` } → 201 `"Currency created"`.
- `POST /api/v1/exchange-rates` (`hasAuthority('rates:write')`), body `CreateExchangeRateRequest` { `baseCurrencyCode`, `quoteCurrencyCode` `@NotBlank @Size(min=3,max=10)`, `buyRate`, `sellRate` `@NotNull @DecimalMin("0", inclusive=false)`, `effectiveDate` Instant `@NotNull` } → 201 `"Exchange rate created"`.
- An "all pairs latest" list exists only under admin (`AdminController` → `latestForAllPairs()`), not for customers.

### 3.9 Instant exchange `/api/v1/exchange`

Rate rule (provisional P7-01): if a rate `source/target` exists, `appliedRate = sellRate`, `rateSide = "SELL"`; otherwise uses `target/source` with `appliedRate = 1 / buyRate` (12 dp, HALF_EVEN), `rateSide = "INVERSE_BUY"`. `targetAmount = sourceAmount × appliedRate` scaled to target precision; or `sourceAmount = targetAmount ÷ appliedRate` scaled to source precision. No fees.

Common request `ExchangeCalculateRequest` (provide **exactly one** of `sourceAmount`/`targetAmount`):

| Field | Type | Constraints |
|---|---|---|
| `sourceWalletId` | UUID | `@NotNull`; caller's wallet |
| `targetWalletId` | UUID | `@NotNull`; caller's wallet, different wallet and currency |
| `sourceAmount` | BigDecimal | `@DecimalMin(value = "0", inclusive = false)`, optional |
| `targetAmount` | BigDecimal | `@DecimalMin(value = "0", inclusive = false)`, optional |

Common errors: 400 `EXCHANGE_AMOUNT_REQUIRED`, 404 (`"Source wallet not found"`, `"Target wallet not found"`, `"Currency not found: X"`, `"No exchange rate for X/Y"`), 400 `EXCHANGE_SAME_WALLET`, 400 `EXCHANGE_SAME_CURRENCY`, 400 `EXCHANGE_AMOUNT_INVALID`. Balance is **not** checked at calculate/preview time.

#### `POST /api/v1/exchange/calculate` — VERIFIED
- Auth: Bearer. Success: 200. No quote persisted.
- Response `data` `ExchangeCalculationResponse`: `sourceWalletId` UUID, `targetWalletId` UUID, `sourceCurrencyCode` string, `targetCurrencyCode` string, `sourceAmount` BigDecimal, `targetAmount` BigDecimal, `appliedRate` BigDecimal, `rateSide` string.

#### `POST /api/v1/exchange/preview` — VERIFIED
- Auth: Bearer. Success: **201**, message `"Quote created"`. Creates a quote valid for `EXCHANGE_QUOTE_TTL` (default **60s**).
- Response `data` `ExchangeQuoteResponse`: `quoteId` UUID, `sourceWalletId` UUID, `targetWalletId` UUID, `sourceCurrencyCode` string, `targetCurrencyCode` string, `sourceAmount` BigDecimal, `targetAmount` BigDecimal, `appliedRate` BigDecimal, `rateSide` string, `expiresAt` Instant, `status` string (`ExchangeQuoteStatus` name, `"OPEN"`).

#### `POST /api/v1/exchange/execute` — VERIFIED
- Auth: Bearer. **Header `Idempotency-Key` required.** No PIN. Success: **201**, message `"Exchange executed"`.
- Request `ExecuteExchangeRequest`: `quoteId` UUID `@NotNull`.
- Behaviour: ledger `DEBIT` source + `CREDIT` target, quote → `EXECUTED`.
- Response `data` `ExchangeTransactionResponse`: `id` UUID, `quoteId` UUID, `sourceWalletId` UUID, `targetWalletId` UUID, `sourceAmount` BigDecimal, `targetAmount` BigDecimal, `appliedRate` BigDecimal, `status` `ExchangeTransactionStatus`, `idempotencyKey` string, `debitLedgerEntryId` UUID, `creditLedgerEntryId` UUID, `failureReason` string|null, `createdAt` Instant.
- Errors: 400 `IDEMPOTENCY_KEY_REQUIRED`, 500 (header missing), 404 (`"Exchange quote not found"`), 409 `EXCHANGE_QUOTE_NOT_OPEN`, 409 `EXCHANGE_QUOTE_EXPIRED`, 409 `EXCHANGE_IDEMPOTENCY_CONFLICT`, 422 `INSUFFICIENT_AVAILABLE_BALANCE`. (On failure the whole transaction rolls back, so a `FAILED` exchange record is not actually persisted.)

#### `GET /api/v1/exchange/transactions/{exchangeId}` — VERIFIED
- Auth: Bearer. Path `exchangeId` UUID. Response `data`: `ExchangeTransactionResponse`. Errors: 404 (`"Exchange transaction not found"`).

### 3.10 P2P `/api/v1/p2p`

P2P is a listing/matching layer only: **no wallet checks, no escrow/hold, no ledger settlement** (`CONTRACT_PENDING (P8-03)`). Orders are created in `ACCEPTED` and customers cannot move them further (only admin can set `COMPLETED`/`CANCELLED`).

`P2PRequestResponse`: `id` UUID, `userId` UUID, `side` `P2PSide`, `baseCurrencyCode` string, `quoteCurrencyCode` string, `amount` BigDecimal, `rate` BigDecimal, `status` `P2PStatus`, `expiresAt` Instant|null, `notes` string|null, `createdAt` Instant.

`P2POrderResponse`: `id` UUID, `requestId` UUID, `requesterId` UUID, `acceptorId` UUID, `amount` BigDecimal, `rate` BigDecimal, `status` `P2PStatus`, `createdAt` Instant.

#### `POST /api/v1/p2p/requests` — VERIFIED
- Auth: Bearer. Success: **201**, message `"P2P request created"`.
- Request `CreateP2PRequestDto`:

| Field | Type | Constraints |
|---|---|---|
| `side` | `P2PSide` | `@NotNull` (`BUY`/`SELL`) |
| `baseCurrencyCode` | string | `@NotBlank @Size(min = 3, max = 10)`; must exist |
| `quoteCurrencyCode` | string | `@NotBlank @Size(min = 3, max = 10)`; must exist, ≠ base |
| `amount` | BigDecimal | `@NotNull @DecimalMin(value = "0", inclusive = false)` |
| `rate` | BigDecimal | `@NotNull @DecimalMin(value = "0", inclusive = false)` |
| `expiresAt` | Instant | optional; must be in the future |
| `notes` | string | `@Size(max = 500)`, optional |

- Response `data`: `P2PRequestResponse` (`status: "OPEN"`).
- Errors: 400 `P2P_SAME_CURRENCY`, 404 (`"Currency not found: X"`), 400 `P2P_EXPIRES_INVALID`.

#### `PUT /api/v1/p2p/requests/{requestId}` — VERIFIED
- Auth: Bearer (owner). Path `requestId` UUID. Success: 200.
- Request `UpdateP2PRequestDto` (all optional; null = unchanged): `amount` BigDecimal `@DecimalMin("0", inclusive=false)`, `rate` BigDecimal `@DecimalMin("0", inclusive=false)`, `expiresAt` Instant (future), `notes` string `@Size(max = 500)`.
- Response `data`: `P2PRequestResponse`.
- Errors: 404 (`"P2P request not found"`), 409 `P2P_NOT_OPEN`, 400 `P2P_EXPIRES_INVALID`.

#### `DELETE /api/v1/p2p/requests/{requestId}` — VERIFIED
- Auth: Bearer (owner). Soft cancel `OPEN` → `CANCELLED`. Success: 200, message `"P2P request cancelled"`, no `data`.
- Errors: 404, 409 `P2P_NOT_OPEN`.

#### `POST /api/v1/p2p/requests/{requestId}/accept` — VERIFIED
- Auth: Bearer (non-owner). No body. Success: **201**, message `"P2P request accepted"`. Request → `ACCEPTED`; order created with the request's amount/rate.
- Response `data`: `P2POrderResponse`.
- Errors: 404, 409 `P2P_NOT_OPEN`, 409 `P2P_SELF_ACCEPT`.

#### `GET /api/v1/p2p/me/requests` — VERIFIED
- Auth: Bearer. Response `data`: array of `P2PRequestResponse` (all statuses, newest first). Returns the stored status: an `OPEN` request past `expiresAt` is only flipped to `EXPIRED` when that request is read or written individually.

#### `GET /api/v1/p2p/me/orders` — VERIFIED (added in mobile Phase 8)
- Auth: Bearer. Response `data`: array of `P2POrderSummaryResponse` for orders where the caller is the requester or the acceptor, newest first. Includes orders created by a negotiated accept.
- `P2POrderSummaryResponse`: all `P2POrderResponse` fields plus the originating request's `side` `P2PSide`, `baseCurrencyCode` string, `quoteCurrencyCode` string (null only if the request row were missing).

#### `GET /api/v1/p2p/requests/{requestId}` — VERIFIED
- Auth: Bearer (any user; no ownership check). Response `data`: `P2PRequestResponse`. Errors: 404.

#### `GET /api/v1/p2p/requests` — VERIFIED
- Auth: Bearer. No query params (no filtering by currency/side, no pagination). Response `data`: array of `OPEN`, non-expired `P2PRequestResponse` from all users (including the caller's), newest first.

#### `GET /api/v1/p2p/orders/{orderId}` — VERIFIED
- Auth: Bearer (requester or acceptor only). Response `data`: `P2POrderResponse`. Errors: 404 (`"P2P order not found"`, also for non-participants).

### 3.11 Negotiations `/api/v1/negotiations`

`NegotiationResponse`: `id` UUID, `p2pRequestId` UUID, `requesterId` UUID (request owner), `counterpartyId` UUID (initiator), `status` `NegotiationStatus`, `currentOfferId` UUID, `offers` array of `OfferResponse`, `createdAt` Instant, `p2pOrderId` UUID|null (order created on accept; V26), `closedReason` `NegotiationCloseReason`|null (set when CANCELLED), `closedBy` UUID|null (participant who rejected/cancelled; null for `REQUEST_CLOSED`).
`OfferResponse`: `id` UUID, `offeredBy` UUID, `offerType` `NegotiationOfferType`, `amount` BigDecimal, `rate` BigDecimal, `status` `NegotiationOfferStatus`, `createdAt` Instant. Offers are ordered oldest first.

#### `POST /api/v1/negotiations/offers` — VERIFIED
- Auth: Bearer (must not own the P2P request). Success: **201**, message `"Offer created"`.
- Request `CreateOfferRequest`: `p2pRequestId` UUID `@NotNull`; `amount` BigDecimal `@NotNull @DecimalMin("0", inclusive=false)`; `rate` BigDecimal `@NotNull @DecimalMin("0", inclusive=false)`.
- Response `data`: `NegotiationResponse` (`status: "OPEN"`, one `OFFER` in `PENDING`).
- Errors: 404 (`"P2P request not found"`), 409 `P2P_NOT_OPEN`, 409 `NEGOTIATION_SELF_OFFER`, 409 `NEGOTIATION_EXISTS`.

#### `POST /api/v1/negotiations/{negotiationId}/counter` — VERIFIED
- Auth: Bearer (participant who did not author the current offer). Success: 200.
- Request `CounterOfferRequest`: `amount` BigDecimal `@NotNull @DecimalMin("0", inclusive=false)`; `rate` BigDecimal `@NotNull @DecimalMin("0", inclusive=false)`.
- Previous offer → `SUPERSEDED`; new `COUNTER` in `PENDING`.
- Errors: 404 (`"Negotiation not found"`), 409 `NEGOTIATION_NOT_OPEN`, 409 `NEGOTIATION_NO_OFFER`, 409 `NEGOTIATION_OFFER_NOT_PENDING`, 409 `NEGOTIATION_WAIT_TURN`.

#### `POST /api/v1/negotiations/{negotiationId}/accept` — VERIFIED
- Auth: Bearer (participant who did not author the current offer). No body. Success: 200, message `"Negotiation accepted"`.
- Behaviour: offer → `ACCEPTED`, negotiation → `ACCEPTED`, P2P request updated with negotiated amount/rate and an order is created (acceptor = counterparty). The response's `p2pOrderId` is the new order (V26). The request leaving OPEN closes the request's other OPEN negotiations (`REQUEST_CLOSED`).
- Errors: 404, 409 `NEGOTIATION_NOT_OPEN`, 409 `NEGOTIATION_NO_OFFER`, 409 `NEGOTIATION_OFFER_NOT_PENDING`, 409 `NEGOTIATION_CANNOT_ACCEPT_OWN`, 409 `P2P_NOT_OPEN`, 409 `P2P_SELF_ACCEPT`, 400 `P2P_TERMS_REQUIRED` / `P2P_TERMS_INVALID`.

#### `POST /api/v1/negotiations/{negotiationId}/reject` — VERIFIED (V26)
- Auth: Bearer (participant who did not author the current offer, i.e. whose turn it is). No body. Success: 200, message `"Offer declined"`.
- Behaviour: current offer → `REJECTED`; negotiation → `CANCELLED`, `closedReason` `REJECTED`, `closedBy` = caller. To propose other terms instead, counter.
- Errors: 404 (also for non-participants), 409 `NEGOTIATION_NOT_OPEN`, 409 `NEGOTIATION_NO_OFFER`, 409 `NEGOTIATION_OFFER_NOT_PENDING`, 409 `NEGOTIATION_CANNOT_REJECT_OWN`.

#### `POST /api/v1/negotiations/{negotiationId}/cancel` — VERIFIED (V26)
- Auth: Bearer (either participant, on either turn). No body. Success: 200, message `"Negotiation cancelled"`.
- Behaviour: a pending current offer → `REJECTED`; negotiation → `CANCELLED`, `closedReason` `CANCELLED`, `closedBy` = caller.
- Errors: 404 (also for non-participants), 409 `NEGOTIATION_NOT_OPEN`.

#### Automatic close when the request leaves OPEN — VERIFIED (V26)
When a P2P request is accepted (directly or through another negotiation), cancelled by its owner, closed by an admin (from OPEN), or recorded as EXPIRED, each of its OPEN negotiations gets its pending offer `REJECTED` and becomes `CANCELLED` with `closedReason` `REQUEST_CLOSED` and `closedBy` null, in the same transaction. Expiry is recorded by a scheduled sweep (`P2PExpiryJob`, every 30 s by default, `P2P_EXPIRY_SWEEP_MS`) and also on any read or write of the request, so negotiations on an expired request close within about one sweep interval of `expiresAt`, with the usual realtime update.

#### Realtime: `/user/queue/negotiations` — VERIFIED (V26)
After every committed change (offer, counter, accept, reject, cancel, automatic close) the full `NegotiationResponse` is sent to both participants on STOMP `/user/queue/negotiations` (subscribe to that destination; Spring routes it to the session user). Raw JSON, not wrapped; `amount`/`rate` are JSON numbers (parse losslessly).

#### `GET /api/v1/negotiations/{negotiationId}` — VERIFIED
- Auth: Bearer (participant). Response `data`: `NegotiationResponse`. Errors: 404.

#### `GET /api/v1/negotiations/me` — VERIFIED (added in mobile Phase 9)
- Auth: Bearer. Optional query `p2pRequestId` UUID. Response `data`: array of `NegotiationResponse` where the caller is the request owner (`requesterId`) or the counterparty, newest first. With `p2pRequestId`, only that request's negotiations the caller takes part in (the owner sees all offers on their request; others see only their own).

Enums: `NegotiationStatus` = `OPEN`, `ACCEPTED`, `CANCELLED` (no `REJECTED`); `NegotiationOfferStatus` = `PENDING`, `SUPERSEDED`, `ACCEPTED`, `REJECTED`; `NegotiationOfferType` = `OFFER`, `COUNTER`; `NegotiationCloseReason` = `REJECTED`, `CANCELLED`, `REQUEST_CLOSED`.

### 3.12 Chat REST `/api/v1/chat`

Rooms are bound to a **P2P order** (one room per order, two participants = requester and acceptor). There is no chat during negotiation (before an order exists).

`ChatRoomResponse`: `id` UUID, `p2pOrderId` UUID, `participantAId` UUID (requester), `participantBId` UUID (acceptor), `createdAt` Instant, `participantALastReadAt` / `participantBLastReadAt` Instant|null (`createdAt` of the latest message that participant has read; V26).
`ChatMessageResponse`: `id` UUID, `roomId` UUID, `senderId` UUID, `content` string, `clientMessageId` string|null, `createdAt` Instant.

#### `POST /api/v1/chat/rooms` — VERIFIED
- Auth: Bearer (order participant). Success: **201**, message `"Chat room ready"` (returns the existing room if already created — still 201).
- Request `CreateChatRoomRequest`: `p2pOrderId` UUID `@NotNull`.
- Response `data`: `ChatRoomResponse`.
- Errors: 404 (`"P2P order not found"`), 403 `CHAT_NOT_PARTICIPANT`.

#### `GET /api/v1/chat/rooms` — VERIFIED
- Auth: Bearer. Response `data`: array of `ChatRoomResponse` (ordered by room `updatedAt` desc; no last-message/unread info).

#### `GET /api/v1/chat/rooms/{roomId}` — VERIFIED
- Auth: Bearer (participant). Response `data`: `ChatRoomResponse`. Errors: 404 (`"Chat room not found"`).

#### `GET /api/v1/chat/rooms/{roomId}/messages` — VERIFIED
- Auth: Bearer (participant). Query `page`, `size` (default **50**), `sort`. Response `data`: `Page<ChatMessageResponse>` (shape A), **newest first**. Use after reconnect to backfill.

#### `POST /api/v1/chat/rooms/{roomId}/messages` — VERIFIED
- Auth: Bearer (participant). Success: **201**, no message.
- Request `SendChatMessageRequest`: `content` string `@NotBlank @Size(max = 4000)` (trimmed); `clientMessageId` string `@Size(max = 100)`, optional — if a message with the same `clientMessageId` exists in the room, that message is returned and nothing is re-broadcast.
- Response `data`: `ChatMessageResponse`. Also broadcast to STOMP `/topic/rooms.{roomId}`.
- Errors: 404.

#### `POST /api/v1/chat/rooms/{roomId}/read` — VERIFIED (V26)
- Auth: Bearer (participant). Success: 200.
- Request `MarkChatReadRequest`: `messageId` UUID `@NotNull` (a message in this room; typically the newest one received).
- Behaviour: sets the caller's `LastReadAt` to that message's `createdAt` only if it moves forward (never backwards; atomic, doesn't touch the room's `updatedAt`). When it moves, `ChatReadReceiptResponse` { `roomId`, `userId`, `lastReadAt` } is broadcast on STOMP `/topic/rooms.{roomId}.reads`.
- Response `data`: `ChatRoomResponse` (current markers).
- Errors: 404 `"Chat room not found"` (also for non-participants), 404 `"Chat message not found"` (message not in the room).

### 3.13 Chat WebSocket / STOMP

Source: `palpeer-chat/.../config/WebSocketConfig.java`, `security/StompAuthChannelInterceptor.java`, `web/ChatStompController.java`, `service/ChatService.java`.

| Item | Verified value |
|---|---|
| STOMP endpoint | `/ws` |
| SockJS | **Yes** (`.withSockJS()`). Use `sockjs-client` at `http(s)://host:8080/ws`, or a native WebSocket STOMP client at the SockJS raw transport URL `ws(s)://host:8080/ws/websocket`. A plain `ws://host/ws` without SockJS framing will not work. |
| Allowed origins | `setAllowedOriginPatterns("*")` |
| HTTP handshake auth | none (`/ws`, `/ws/**` are `permitAll`) |
| Application destination prefix | `/app` |
| Broker | Spring simple in-memory broker on `/topic` and `/queue` |
| User destination prefix | `/user`. The STOMP principal name is the **user id** (V26), so the server sends with `convertAndSendToUser(userId, ...)`; clients subscribe to `/user/queue/<name>`. Used by `/user/queue/negotiations`. |
| Inbound (client → server) | `SEND /app/rooms/{roomId}/send` with JSON body `SendChatMessageRequest` { `content`, `clientMessageId` } (`@Valid @Payload`) |
| Outbound (server → client) | `/topic/rooms.{roomId}` (note the **dot**) carrying a raw `ChatMessageResponse` JSON (**not** wrapped in `ApiResponse`); `/topic/rooms.{roomId}.reads` carrying a raw `ChatReadReceiptResponse`; `/user/queue/negotiations` carrying a raw `NegotiationResponse`. Verified live: Instants are ISO-8601 strings; binary STOMP frames (as sent by React Native clients) are accepted. |
| CONNECT auth | `ChannelInterceptor` (`StompAuthChannelInterceptor`) on the inbound channel, **CONNECT frame only**: native STOMP header `Authorization: Bearer <accessToken>` **or** native header `token: <accessToken>`. Query-string tokens are **not** read (despite the class comment). Must be an access token (`token_type=access`); user must be enabled. Failure throws `IllegalArgumentException` → STOMP ERROR frame / disconnect. |
| Token expiry | Not re-checked after CONNECT; reconnect with a fresh token after refresh. |
| SUBSCRIBE authorization | Enforced in `StompAuthChannelInterceptor`: `/topic/rooms.{roomId}` and `/topic/rooms.{roomId}.reads` only for the room's two participants; `/user/queue/**` allowed; any other destination (including wildcards) → STOMP ERROR frame. |
| SEND authorization | Frame-level: only `/app/**` destinations accepted (direct SENDs to `/topic`/`/queue` are rejected). Then `ChatService.send` requires room participation; failures (not participant, validation) are only logged — **no error is sent back** (no `@MessageExceptionHandler`, no `/user/queue/errors`). Prefer REST `POST /chat/rooms/{roomId}/messages` when you need confirmation. |
| Heartbeats | Not configured (simple broker without task scheduler → no server heartbeats). |
| Presence (`chat.addUser`/`chat.removeUser`) | **Absent.** Joining = subscribing to the room topic. |

### 3.14 Transactions feed `/api/v1/transactions`

Unified projection over **funding, withdrawal and exchange only** (P2P, cards, bonuses are excluded).

`TransactionItemResponse`:

| Field | Type | Notes |
|---|---|---|
| `type` | `TransactionActivityType` | `FUNDING`, `WITHDRAWAL`, `EXCHANGE` |
| `id` | UUID | source transaction id |
| `userId` | UUID | |
| `status` | string | `MoneyMovementStatus` name for FUNDING/WITHDRAWAL; `ExchangeTransactionStatus` name for EXCHANGE |
| `walletId` | UUID | exchange: source wallet |
| `secondaryWalletId` | UUID\|null | exchange: target wallet |
| `currencyCode` | string | exchange: source currency |
| `secondaryCurrencyCode` | string\|null | exchange: target currency |
| `amount` | BigDecimal | exchange: source amount |
| `secondaryAmount` | BigDecimal\|null | exchange: target amount |
| `appliedRate` | BigDecimal\|null | exchange only |
| `failureReason` | string\|null | |
| `ledgerEntryIds` | object (string → UUID) | keys: funding `credit`, `reversal`; withdrawal `hold`, `release`, `debit`, `reversal`; exchange `debit`, `credit` |
| `createdAt` | Instant | |
| `updatedAt` | Instant | |

#### `GET /api/v1/transactions/recent` — VERIFIED
- Auth: Bearer. Query `limit` int (default **20**, clamped 1..100). Response `data`: array of `TransactionItemResponse`, newest first.

#### `GET /api/v1/transactions/{type}/{id}` — VERIFIED
- Auth: Bearer. Path `type` `TransactionActivityType` (case-sensitive: `FUNDING`|`WITHDRAWAL`|`EXCHANGE`), `id` UUID. Response `data`: `TransactionItemResponse`.
- Errors: 400 `INVALID_PARAMETER` (bad type/uuid), 404 (`"Funding transaction not found"` etc.).

#### `GET /api/v1/transactions/history` — VERIFIED
- Auth: Bearer. Query: `type` `TransactionActivityType` (optional), `from` Instant ISO (optional, default epoch), `to` Instant ISO (optional, default now + 1 day), `page` int (default 0), `size` int (default 20, clamped 1..100).
- Response `data`: `TransactionPageResponse` { `items`, `page`, `size`, `totalElements`, `totalPages` } (shape B).

#### `GET /api/v1/transactions/summary` — VERIFIED
- Auth: Bearer. Query: `from`, `to` Instant ISO (optional; default window = last **30 days** ending now).
- Response `data` `TransactionSummaryResponse`: `from` Instant, `to` Instant, `totalCount` long, `countByType` object (`{"FUNDING": n, "WITHDRAWAL": n, "EXCHANGE": n}`), `countByStatus` object (keys namespaced `"<TYPE>:<STATUS>"`, e.g. `"FUNDING:SUCCESS"`), `successfulFundingByCurrency` array, `successfulWithdrawalByCurrency` array, `successfulExchangeCount` long.
  - `CurrencyAmountTotal`: `currencyCode` string, `totalAmount` BigDecimal, `count` long.

### 3.15 Cards `/api/v1/cards`

Provider is `StubCardProvider` (`providerName: "STUB"`), no real issuer. Cards are **not funded or settled** against wallets.

`CardResponse`: `id` UUID, `walletId` UUID|null, `providerName` string, `providerCardId` string, `lastFour` string (4 chars), `brand` string (stub: `"VISA"`), `currencyCode` string, `status` `CardStatus`, `expiryMonth` Integer (stub: 12), `expiryYear` Integer (stub: 2030), `cardholderName` string|null, `createdAt` Instant.

`CardTransactionResponse`: `id` UUID, `cardId` UUID, `providerTransactionId` string, `entryType` `CardTransactionType`, `status` `CardTransactionStatus`, `amount` BigDecimal, `currencyCode` string, `merchantName` string|null, `occurredAt` Instant, `ledgerEntryId` UUID|null (always null today), `failureReason` string|null, `createdAt` Instant.

#### `POST /api/v1/cards` — VERIFIED
- Auth: Bearer. Success: **201**, message `"Card issued"`. Card is `ACTIVE` immediately. No fee, no preview, no type (virtual/physical) field.
- Request `IssueCardRequest`: `currencyCode` string `@NotBlank @Size(max = 10)` (must exist); `walletId` UUID optional (must be caller's and same currency); `cardholderName` string `@Size(max = 120)` optional.
- Response `data`: `CardResponse`.
- Errors: 404 (`"Currency not found: X"`, `"Wallet not found"`), 400 `CARD_WALLET_CURRENCY_MISMATCH`.

#### `GET /api/v1/cards` — VERIFIED
- Auth: Bearer. Response `data`: array of `CardResponse`, newest first.

#### `GET /api/v1/cards/{cardId}` — VERIFIED
- Auth: Bearer. Response `data`: `CardResponse`. Errors: 404 (`"Card not found"`).

#### `POST /api/v1/cards/{cardId}/block` — VERIFIED
- Auth: Bearer. No body. Response `data`: `CardResponse` (`status: "BLOCKED"`; idempotent if already blocked). There is no "freeze" — block is the freeze equivalent.
- Errors: 404, 409 `CARD_CLOSED`.

#### `POST /api/v1/cards/{cardId}/unblock` — VERIFIED
- Auth: Bearer. Response `data`: `CardResponse` (`status: "ACTIVE"`). Errors: 404, 409 `CARD_NOT_BLOCKED`.

#### `GET /api/v1/cards/{cardId}/transactions` — VERIFIED
- Auth: Bearer. Query `page`, `size` (default **20**), `sort`. Syncs from provider (stub returns none) then returns `Page<CardTransactionResponse>` (shape A), newest `occurredAt` first. Errors: 404.

### 3.16 Notifications `/api/v1/notifications`

`DeviceTokenResponse`: `id` UUID, `platform` `DeviceTokenPlatform`, `deviceIdentifier` string|null, `enabled` boolean, `lastSeenAt` Instant, `createdAt` Instant, `updatedAt` Instant.
`NotificationResponse`: `id` UUID, `title` string, `body` string, `category` string|null (free text, e.g. `"REFERRAL"`), `channel` `NotificationChannel`, `status` `NotificationStatus`, `referenceType` string|null (e.g. `"REFERRAL"`), `referenceId` UUID|null, `readAt` Instant|null, `sentAt` Instant|null, `failureReason` string|null, `createdAt` Instant.

Push delivery is a logging stub (`LoggingPushNotifier`); no FCM/APNs integration.

#### `POST /api/v1/notifications/device-tokens` — VERIFIED
- Auth: Bearer. Success: **201**, message `"Device token registered"`. Upsert by `token` (re-assigns a token from another user to the caller; re-enables it).
- Request `RegisterDeviceTokenRequest`: `token` string `@NotBlank @Size(max = 512)`; `platform` `DeviceTokenPlatform` `@NotNull`; `deviceIdentifier` string `@Size(max = 255)` optional.
- Response `data`: `DeviceTokenResponse`.

#### `GET /api/v1/notifications/device-tokens` — VERIFIED
- Auth: Bearer. Response `data`: array of `DeviceTokenResponse` (by `updatedAt` desc).

#### `POST /api/v1/notifications/device-tokens/{tokenId}/disable` — VERIFIED
- Auth: Bearer. Path `tokenId` UUID (the record id, not the push token). Response `data`: `DeviceTokenResponse`. Errors: 404 (`"Device token not found"`).

#### `DELETE /api/v1/notifications/device-tokens/{tokenId}` — VERIFIED
- Auth: Bearer. Success: **204 No Content, empty body**. Errors: 404.

#### `GET /api/v1/notifications` — VERIFIED
- Auth: Bearer. Query: `status` `NotificationStatus` (optional), `page`, `size` (default **20**), `sort`. Response `data`: `Page<NotificationResponse>` (shape A), newest first.

#### `GET /api/v1/notifications/unread-count` — VERIFIED
- Auth: Bearer. Response `data`: `{ "count": <long> }` (= notifications in `PENDING` + `SENT`).

#### `GET /api/v1/notifications/{notificationId}` — VERIFIED
- Auth: Bearer. Response `data`: `NotificationResponse`. Errors: 404 (`"Notification not found"`).

#### `POST /api/v1/notifications/{notificationId}/read` — VERIFIED
- Auth: Bearer. No body. Response `data`: `NotificationResponse` (`status: "READ"`, `readAt` set; idempotent). Errors: 404.

### 3.17 Promotions and referrals `/api/v1/promotions`

`PromotionResponse`: `id` UUID, `code` string, `title` string, `description` string|null, `promotionType` `PromotionType`, `active` boolean, `startsAt` Instant|null, `endsAt` Instant|null, `bonusAmount` BigDecimal|null, `bonusCurrencyCode` string|null, `createdAt` Instant.
`ReferralResponse`: `id` UUID, `referrerUserId` UUID, `refereeUserId` UUID|null, `referralCode` string (format `REF` + 10 upper-case hex chars), `status` `ReferralStatus`, `promotionId` UUID|null, `createdAt` Instant.
`BonusResponse`: `id` UUID, `userId` UUID, `promotionId` UUID|null, `referralId` UUID|null, `amount` BigDecimal, `currencyCode` string, `status` `BonusStatus`, `reason` string|null (`"Referral bonus"` / `"Referred signup bonus"`), `ledgerEntryId` UUID|null (always null today), `createdAt` Instant.

#### `GET /api/v1/promotions/active` — VERIFIED
- Auth: Bearer. Response `data`: array of `PromotionResponse` where `active=true` and now is within `[startsAt, endsAt]`. Not personalised (no eligibility logic).

#### `POST /api/v1/promotions/referrals/my-code` — VERIFIED
- Auth: Bearer. No body. Response `data`: `ReferralResponse` — the caller's unused (`refereeUserId == null`) referral, created if absent. **Codes are single-use**: once applied by someone, the next call returns a new code.

#### `GET /api/v1/promotions/referrals/mine` — VERIFIED
- Auth: Bearer. Response `data`: array of `ReferralResponse` created by the caller (newest first).

#### `POST /api/v1/promotions/referrals/apply` — VERIFIED
- Auth: Bearer. Success: 200, message `"Referral applied"`.
- Request `ApplyReferralRequest`: `referralCode` string `@NotBlank @Size(max = 40)` (case-insensitive).
- Behaviour: referral → `COMPLETED`; if an active `REFERRAL` promotion with a bonus exists, two `PENDING` bonuses are created (referrer + referee; no ledger credit). Referrer gets an e-mail notification.
- Response `data`: `ReferralResponse`.
- Errors: 409 `REFERRAL_ALREADY_APPLIED`, 404 (`"Referral code not found"`), 409 `REFERRAL_NOT_OPEN`, 400 `REFERRAL_SELF`.

#### `GET /api/v1/promotions/bonuses/mine` — VERIFIED
- Auth: Bearer. Query `page`, `size` (default **20**), `sort`. Response `data`: `Page<BonusResponse>` (shape A).

#### `POST /api/v1/promotions` — VERIFIED — admin authority, not for mobile
- `@PreAuthorize("hasAuthority('promotions:write')")`. Body `CreatePromotionRequest` { `code` `@NotBlank @Size(max=40)`, `title` `@NotBlank @Size(max=200)`, `description` `@Size(max=2000)`, `promotionType` `@NotNull`, `startsAt`, `endsAt`, `bonusAmount` `@DecimalMin("0.000000000001")`, `bonusCurrencyCode` `@Size(max=10)` } → 201 `"Promotion created"`.

### 3.18 Webhooks (server-to-server, not for mobile)

All under `/api/v1/webhooks/**` (`permitAll`):

- `POST /api/v1/webhooks/apaylo` — Apaylo payment callbacks (funding/withdrawal completion). HMAC-SHA256 hex of the raw body required in `APAYLO_WEBHOOK_SIGNATURE_HEADER` (default `X-Webhook-Signature`, optional `sha256=` prefix) keyed with `APAYLO_WEBHOOK_SECRET`. Blank secret → every call 401.
- `POST /api/v1/webhooks/kuda` — Kuda payment callbacks. Same scheme with `KUDA_WEBHOOK_SECRET` / `KUDA_WEBHOOK_SIGNATURE_HEADER`.
- `POST /api/v1/webhooks/complycube` — ComplyCube check results; HMAC-SHA256 header `ComplyCube-Signature` always required; blank `COMPLYCUBE_WEBHOOK_SECRET` → every call 401.
- Payment webhook status handling: success words → settle; fail/declined/rejected/cancelled/expired → fail; missing, pending or unknown status → **no state change** (previously missing status meant success).
- CONTRACT_PENDING (P6-APAYLO-02, P6-KUDA-02): confirm each provider's real signing scheme/header; the generic HMAC scheme is a fail-closed placeholder.

---

## 4. Enums the app must render

All values exact (`name()`):

| Enum | Values | Used in |
|---|---|---|
| `UserStatus` | `PENDING_VERIFICATION`, `ACTIVE`, `SUSPENDED`, `CLOSED` (provisional) | `RegisterResponse.status` (string) only |
| `OtpPurpose` | `EMAIL_VERIFICATION`, `PHONE_VERIFICATION`, `PASSWORD_RESET` | OTP verify/resend |
| `OtpChannel` | `EMAIL`, `SMS` | OTP verify/resend |
| `KycStatus` | `NOT_STARTED`, `IN_PROGRESS`, `SUBMITTED`, `UNDER_REVIEW`, `APPROVED`, `REJECTED` | KYC status/progress/verification |
| KYC document type | **No enum** — free-text `documentType` (upper-cased). Values mapped for ComplyCube: `PASSPORT`, `DRIVING_LICENSE` / `DRIVERS_LICENSE` / `DRIVER_LICENSE`, `NATIONAL_ID` / `NATIONAL_IDENTITY_CARD` / `ID_CARD`, `RESIDENCE_PERMIT`, `VISA`, `UTILITY_BILL`, `BANK_STATEMENT`; anything else → `other` | KYC upload |
| Wallet status | **No enum / no field** | — |
| `LedgerEntryType` | `CREDIT`, `DEBIT`, `HOLD`, `RELEASE` | wallet transactions |
| `MoneyMovementStatus` (funding + withdrawal) | `INITIATED`, `PENDING`, `PROCESSING`, `SUCCESS`, `FAILED`, `REVERSED` | funding, withdrawal, transactions feed |
| `ExchangeQuoteStatus` | `OPEN`, `EXECUTED`, `EXPIRED`, `CANCELLED` | `ExchangeQuoteResponse.status` (string) |
| `ExchangeTransactionStatus` | `INITIATED`, `SUCCESS`, `FAILED` | exchange, transactions feed |
| Exchange `rateSide` (string, not enum) | `SELL`, `INVERSE_BUY` | calculate/preview |
| `P2PStatus` (requests and orders) | `OPEN`, `ACCEPTED`, `COMPLETED`, `EXPIRED`, `CANCELLED` | P2P |
| `P2PSide` | `BUY`, `SELL` (semantics `CONTRACT_PENDING (P8-01)`) | P2P |
| `NegotiationStatus` | `OPEN`, `ACCEPTED`, `CANCELLED` | negotiations |
| `NegotiationOfferType` | `OFFER`, `COUNTER` | negotiation offers |
| `NegotiationOfferStatus` | `PENDING`, `SUPERSEDED`, `ACCEPTED`, `REJECTED` | negotiation offers (`REJECTED` on reject, cancel or automatic close) |
| `NegotiationCloseReason` | `REJECTED`, `CANCELLED`, `REQUEST_CLOSED` | negotiations (`closedReason`, V26) |
| `CardStatus` | `PENDING`, `ACTIVE`, `BLOCKED`, `CLOSED` | cards (`PENDING`/`CLOSED` never set by customer flows) |
| Card type (virtual/physical) | **No enum / no field** | — |
| `CardTransactionType` | `AUTHORIZATION`, `CAPTURE`, `REFUND`, `REVERSAL`, `FEE`, `OTHER` | card transactions |
| `CardTransactionStatus` | `PENDING`, `SETTLED`, `FAILED`, `REVERSED` | card transactions |
| `NotificationStatus` | `PENDING`, `SENT`, `FAILED`, `READ` | notifications |
| `NotificationChannel` | `IN_APP`, `PUSH`, `EMAIL`, `BOTH` | notifications |
| Notification type/category | **No enum** — `category` free text (only producer today: `"REFERRAL"`) | notifications |
| `DeviceTokenPlatform` (push) | `IOS`, `ANDROID`, `WEB`, `OTHER` | device tokens |
| Security device `platform` | **No enum** — free text ≤ 40 chars | security devices |
| Biometric type | **No enum / no field** | — |
| `PromotionType` | `REFERRAL`, `SIGNUP`, `CAMPAIGN`, `OTHER` | promotions |
| `ReferralStatus` | `OPEN`, `COMPLETED`, `CANCELLED` | referrals |
| `BonusStatus` | `PENDING`, `GRANTED`, `CANCELLED`, `FAILED` | bonuses (only `PENDING` produced) |
| `TransactionActivityType` | `FUNDING`, `WITHDRAWAL`, `EXCHANGE` | transactions feed |
| Security question list | **No catalogue** — questions are client-supplied (`questionKey` + `questionText`) | security questions |

---

## 5. Funding methods and providers

Source: `PaymentRailProvider`, `PaymentRailRouter`, `ApayloPaymentRail`, `KudaPaymentRail`, `FundingService`.

| Currency | Provider (`providerName`) | Funding method | Withdrawal method | Enable flags |
|---|---|---|---|---|
| `CAD` | `APAYLO` | Instant Interac deposit only — checkout Link (`RequestInteracEtransferLink`); customer sends to account name (`APAYLO_ACCOUNT_ID`) | Interac e-Transfer send (e-mail/phone) or EFT (`institution:transit:account`) | `APAYLO_ENABLED` + `APAYLO_API_KEY` + `APAYLO_SHARED_KEY` |
| `NGN` | `KUDA` | Create/reuse per-wallet VA → `PENDING` + `paymentDetails` (bank transfer). Wallet credits only after Kuda webhook (or optional sandbox `KUDA_DEMO_FUND_ENABLED` shortcut) | `SINGLE_FUND_TRANSFER` after `NAME_ENQUIRY` (`bankCode:accountNumber`) | `KUDA_ENABLED` + `KUDA_EMAIL` + `KUDA_API_KEY` |
| other | none | — | — | — |

`.env` / `.env.example` ship with `APAYLO_ENABLED=false` and `KUDA_ENABLED=false`, so in dev **no rail is active**.

`POST /api/v1/funding` accepts only `{ walletId, amount, providerReference? }` — the client cannot choose a method; the rail is chosen by the wallet currency.

- Rail enabled → `status: "PENDING"`, `providerName`, `providerReference`, and `fundingInstructions` (plain-text):
  - Apaylo: Instant Interac deposit instructions (customer sends to searchable account name; no request email).
  - Kuda: `"Transfer NGN <amount> to Kuda virtual account <accountNumber> (<accountName>); bank=<bankName>; tracking=<trackingReference>; ref=<fundingId>"` plus structured `paymentDetails` for the mobile VA payment step.
- No rail → `status: "INITIATED"`, no provider fields, no instructions; nothing completes it except `POST /funding/{id}/process` or the webhook.
- Completion: provider webhook (`/api/v1/webhooks/apaylo|kuda`) → `SUCCESS` (ledger `CREDIT`) or `FAILED`. Poll `GET /funding/{id}` or `GET /transactions/FUNDING/{id}`. NGN is not credited until that confirmation (unless sandbox demo fund is explicitly enabled).
- `process` / `fail` / `reverse` on `/funding/{id}/*` and `/withdrawals/{id}/*` are operator-only (`ROLE_ADMIN` + `payments:operate`, V25); customers get 403. The mobile app must not call them.
- No endpoint lists funding methods, banks, or saved beneficiaries; there is no NGN bank list or name-enquiry endpoint for the app.

---

## 6. KYC upload constraints

- Endpoints: `POST /api/v1/kyc/documents` (parts `documentType` + `file`), `POST /api/v1/kyc/selfie` (part `file`). Content type `multipart/form-data`.
- **Allowed content types: no allowlist.** Whatever the client sends as the part content type is stored (`application/octet-stream` if absent). ComplyCube upload appends `.jpg` to filenames not ending in `.jpg/.jpeg/.png/.pdf`, so send JPEG/PNG (or PDF for documents).
- Max size: `spring.servlet.multipart.max-file-size=${UPLOAD_MAX_FILE_SIZE:10MB}`, `max-request-size=${UPLOAD_MAX_REQUEST_SIZE:12MB}`. Exceeding it is not specifically handled (expected 500).
- Empty file → 400 `FILE_REQUIRED`. Filename sanitised to `[a-zA-Z0-9._-]` for storage (response echoes the original name).
- Multiple documents/selfies may be uploaded; verification uses the latest of each. Only one side ("front") is sent to ComplyCube; there is no `side` field.
- Uploads allowed only while status is `NOT_STARTED`, `IN_PROGRESS` or `REJECTED` (else 409 `KYC_UPLOAD_NOT_ALLOWED`).
- `GET /kyc/status` returns `{ caseId, userId, status, rejectionReason, createdAt, updatedAt }`; `GET /kyc/progress` returns `{ caseId, status, hasDocument, documentCount, hasSelfie, selfieCount }` (no percentage/weighting, no required-document list).
- No endpoint lists the user's uploaded documents or lets them delete one.

---

## 7. Card data exposure

`CardResponse` exposes: `id`, `walletId`, `providerName`, `providerCardId`, `lastFour`, `brand`, `currencyCode`, `status`, `expiryMonth`, `expiryYear`, `cardholderName`, `createdAt`.

- Full PAN: **never stored or returned** (entity stores `lastFour` only). There is no masked PAN string — build `•••• 1234` from `lastFour`.
- CVV/PIN: **never stored or returned**; no reveal endpoint.
- `providerCardId` (internal issuer id) **is** returned to the client (low-risk leak). The mobile app drops it (and `providerTransactionId` / `ledgerEntryId` on card transactions) in `cardApi` before caching (R-CD-6). Verified live: present in the raw response, absent from app state.

---

## 8. Biometric and security-question catalogue

- **No `/biometric/**` endpoints exist.** There is no challenge/response registration (`register/init`/`complete`), no biometric login (`login/init`/`complete`), and no `/biometric/revoke`. The only related feature is `/api/v1/security/devices` (register an opaque `biometricCredential` string per `deviceIdentifier`, list, enable, disable, delete). The stored credential is **never used by any authentication flow** (`lastUsedAt` is never set). Biometric login must be implemented client-side (e.g. keychain-stored refresh token unlocked by device biometrics) or is `CONTRACT_PENDING`.
- **No security-question catalogue endpoint exists.** `GET /api/v1/security/questions` returns only the caller's own configured questions. The app must supply its own list of `questionKey`/`questionText` pairs (min 2) when calling `PUT /api/v1/security/questions` (`CONTRACT_PENDING (P3-02)`).

---

## 9. Security issues found

Ordered by severity. Originally audit only.

> **Update 2026-09-28 (migration V25):** items 1–5 are **fixed**, and the PIN lockout half of item 6 (verify, change and reset answers all count). Still open: PIN is not enforced by money endpoints (item 6, first half) and items 7–12, plus items 15–16 found in Phase 5.

1. **Critical — self-credit via funding `process`.** `POST /api/v1/funding/{id}/process` has no `@PreAuthorize`; any user can `POST /funding` with any amount and then `process` it to `SUCCESS`, getting a ledger `CREDIT` with no payment received.
2. **Critical — withdrawal `fail`/`reverse`/`process` by owner.** A user can `fail` a withdrawal after the provider has paid out (hold released back to available) or `reverse` any `SUCCESS` withdrawal (ledger `CREDIT`), creating money.
3. **Critical — unauthenticated payment webhooks.** `/api/v1/webhooks/apaylo` and `/kuda` are `permitAll` with **no signature verification**; a body like `{"fundingId":"<uuid>"}` with no status is treated as success (`isSuccess` returns `true` when status is missing) and credits the wallet.
4. **High — ComplyCube webhook signature optional.** Verification is skipped when `COMPLYCUBE_WEBHOOK_SECRET` is blank (the default), allowing forged KYC approvals for a known check id.
5. **High — STOMP SUBSCRIBE not authorized.** Only CONNECT is authenticated; any logged-in user can subscribe to `/topic/rooms.{roomId}` of any room and read messages. Allowed origins are `*`.
6. **High — no transaction PIN enforcement.** Exchange, withdrawal, P2P and card issue do not require a PIN. `POST /security/pin/verify` has no attempt limit or lockout (a 4-digit PIN is brute-forceable); security-question answers in `pin/reset` also have no lockout.
7. **Medium — OTP brute force / abuse.** 5 attempts per challenge, but `otp/resend` creates unlimited new challenges with no rate limit; no login rate limiting. `otp/verify`, `otp/resend` and `password-reset/confirm` return 404 `USER_NOT_FOUND`, enabling account enumeration (contradicting the non-enumerating `password-reset/request`).
8. **Medium — account state not enforced.** Unverified (`PENDING_VERIFICATION`) users can log in and use every money endpoint; the JWT filter ignores `UserStatus` (only `enabled` is checked). No KYC gating on funding/withdrawal/exchange/cards.
9. **Medium — tokens not revocable server-side.** Logout, password change/reset and session revoke do not invalidate access tokens (valid up to 15 min). Refresh-token reuse does not revoke the token family.
10. **Medium — P2P has no settlement or escrow.** Orders never move funds; any user can read any P2P request by id.
11. **Low — default JWT secret** `CHANGE_ME_PALPEER_DEV_JWT_SECRET_AT_LEAST_32_CHARS` in `AuthProperties`/`application.yml` fallback; a dev SMTP username is committed in `application-dev.yml`.
12. **Low — KYC uploads have no content-type allowlist**; client-declared content type is trusted.
13. **Low — `providerCardId` returned to clients.**
14. **Operational — unauthenticated returns 403 empty body instead of 401**, and several client errors (missing header, bad JSON, bad enum, missing multipart part) surface as 500 `INTERNAL_ERROR`.
15. **Medium — security questions replaceable without re-authentication** (found in Phase 5). `PUT /security/questions` needs only a session, and `POST /security/pin/reset` then accepts the new answers, so a session holder can take over the PIN. The app asks for the PIN first; the backend should require the current PIN or password (contract-pending S-6).
16. **Low — device records aren't enforced.** Disabling or deleting a `/security/devices` record has no server-side effect; the app enforces it at biometric unlock (S-7).

---

## 10. Historical APK endpoint → current backend mapping

All current paths are prefixed with `/api/v1`. "PARTIAL" means an endpoint exists but semantics differ; "NO EQUIVALENT (CONTRACT_PENDING)" means nothing in the backend covers it.

| Historical APK path | Current verified equivalent |
|---|---|
| `/auth/createUser` | `POST /auth/register` |
| `/auth/login` | `POST /auth/login` |
| `/auth/google` | `POST /auth/google` |
| `/auth/logout` | `POST /auth/logout` (body `{ refreshToken }`, public) |
| `/auth/refreshToken` | `POST /auth/refresh` (rotating) |
| `/auth/resendOtp` | `POST /auth/otp/resend` (`email`, `purpose`, `channel`) |
| `/auth/verifyOtp` | `POST /auth/otp/verify` (`purpose: EMAIL_VERIFICATION`, `channel: EMAIL`) |
| `/auth/verifyPhoneNumber` | PARTIAL: `POST /auth/otp/verify` with `purpose: PHONE_VERIFICATION`, `channel: SMS`. SMS is never delivered (placeholder); code only visible in dev logs. |
| `/auth/user/forgot-password` | `POST /auth/password-reset/request` |
| `/auth/user/resendPasswordResetOtp` | `POST /auth/otp/resend` with `purpose: PASSWORD_RESET`, `channel: EMAIL` |
| `/auth/user/reset-password` | `POST /auth/password-reset/confirm` |
| `/users/createProfile` | PARTIAL: `POST /profiles` (empty body; profile has no attributes — P2-01) |
| `/users/getUserInfo` | NO EQUIVALENT (CONTRACT_PENDING). `GET /profiles/me` returns only `{ id, userId }`; no endpoint returns email, phone, status or verification flags. |
| `/users/addKycDocument` | `POST /kyc/documents` (multipart `documentType` + `file`) |
| `/users/saveSelfiePhoto` | `POST /kyc/selfie` (multipart `file`) |
| `/users/setKyc` | PARTIAL: `POST /kyc/verification/start` (ComplyCube only; 503 when disabled). Status via `GET /kyc/status`, `GET /kyc/progress`. |
| `/users/setTransactionPin` | `POST /security/pin` (change: `PUT /security/pin`) |
| `/users/resetPinRequest` | PARTIAL: `POST /security/pin/reset` — single step using security-question answers + `newPin`; no e-mail request step |
| `/users/verifyPinForgotPinEmail` | NO EQUIVALENT (CONTRACT_PENDING) — no e-mail/OTP PIN reset |
| `/users/setSecurityQuestionAnswer` | `PUT /security/questions` (replace-all, min 2) |
| `/biometric/register/init` | NO EQUIVALENT (CONTRACT_PENDING). Closest: `POST /security/devices` (single-step, opaque credential, no challenge) |
| `/biometric/register/complete` | NO EQUIVALENT (CONTRACT_PENDING) (see above) |
| `/biometric/login/init` | NO EQUIVALENT (CONTRACT_PENDING) |
| `/biometric/login/complete` | NO EQUIVALENT (CONTRACT_PENDING) |
| `/biometric/revoke` | PARTIAL: `POST /security/devices/{deviceId}/disable` or `DELETE /security/devices/{deviceId}` |
| `/wallet/createWallet` | `POST /wallets` |
| `/wallet/getUserWallets` | `GET /wallets` |
| `/wallet/getWalletTransactionPreview` | PARTIAL: `GET /wallets/{walletId}/transactions` (ledger entries) or `GET /transactions/recent`; no "preview" (fee/amount estimate) for funding or withdrawal |
| `/wallet/fundWallet` | `POST /funding` (header `Idempotency-Key`) |
| `/wallet/withdrawFund` | `POST /withdrawals` (header `Idempotency-Key`) |
| `/display-rate/getAllSwapRate` | `GET /public/instant-rates` (public InstantEX board). Per pair (authed): `GET /exchange-rates/latest?base=&quote=`. |
| `/wallets/swap` | `POST /exchange/calculate` → `POST /exchange/preview` → `POST /exchange/execute` (header `Idempotency-Key`) |
| `/display-rate/getAllP2pRate` | `GET /public/p2p-rates` (public Live P2P board). Authed marketplace: `GET /p2p/requests`. |
| `/p2pRequest/createP2pRequest` | `POST /p2p/requests` |
| `/p2pRequest/acceptP2pRequest` | `POST /p2p/requests/{requestId}/accept` |
| `/p2pOrder/orderPreview` | NO EQUIVALENT (CONTRACT_PENDING) |
| `/p2pOrder/acceptRequest` | PARTIAL: order is created by `POST /p2p/requests/{requestId}/accept` (or negotiation accept); no order-level accept/confirm/complete endpoint. Read with `GET /p2p/orders/{orderId}`. |
| `/negotiation/placeNegotiation` | `POST /negotiations/offers` (then `POST /negotiations/{id}/counter`, `/accept`) |
| `/negotiate/createRoom` | PARTIAL: `POST /chat/rooms` requires a `p2pOrderId` (only after an order exists; no negotiation-scoped room) |
| `/negotiate/chatRooms` | `GET /chat/rooms` |
| `/transaction/getUserRecentTransactions` | `GET /transactions/recent?limit=` |
| `/transaction/getUserTransaction` | `GET /transactions/{type}/{id}` |
| `/transactions/getUserTransactions` | `GET /transactions/history` |
| `/transactions/summary` | `GET /transactions/summary` |
| `/virtualCard/createCard` | `POST /cards` (stub provider) |
| `/virtualCard/createVirtualCardPreview` | NO EQUIVALENT (CONTRACT_PENDING) |
| `/virtualCard/getUserCards` | `GET /cards` |
| `/wallets/withdrawFromCard` | NO EQUIVALENT (CONTRACT_PENDING) |
| `/notification/registerDeviceToken` | `POST /notifications/device-tokens` |
| STOMP `app/chat.addUser` | NO EQUIVALENT (CONTRACT_PENDING) — no presence; subscribe to `/topic/rooms.{roomId}` |
| STOMP `app/chat.removeUser` | NO EQUIVALENT (CONTRACT_PENDING) — unsubscribe/disconnect only |
| STOMP `sendNegotiationMessage` | PARTIAL: `SEND /app/rooms/{roomId}/send` (room is per P2P order, not per negotiation) or REST `POST /chat/rooms/{roomId}/messages` |

---

## 11. Capabilities in the APK with no backend support

Each item was checked against the controllers listed above.

| Capability | Backend status |
|---|---|
| Wallet deletion | None — `WalletController` has no DELETE |
| Card freeze | Named **block/unblock** (`POST /cards/{id}/block`, `/unblock`); no "freeze" naming |
| Card close/terminate | None (`CLOSED` status exists, no endpoint) |
| Card funding (wallet → card) | None; cards are not linked to ledger |
| Card withdrawal (card → wallet) | None |
| Card creation preview (fees/limits) | None |
| Card PAN/CVV reveal | None (by design) |
| Card type selection (virtual/physical) | None |
| P2P order preview | None |
| P2P order lifecycle (mark paid, release, complete, cancel, dispute) | None for customers (admin-only `COMPLETED`/`CANCELLED`) |
| P2P escrow/settlement | None |
| List my P2P orders | Resolved in Phase 8: `GET /p2p/me/orders` |
| P2P request filtering (currency/side) / pagination | None |
| P2P rate list | None |
| Swap rates list (all pairs) | None for customers (admin only) |
| Negotiation list / reject / cancel | Resolved: `GET /negotiations/me` (Phase 9), `POST /negotiations/{id}/reject` and `/cancel` (V26) |
| Negotiation-scoped chat (before order) | None |
| Chat presence (`addUser`/`removeUser`), typing, unread counts, last message | None (read receipts resolved in V26: `POST /chat/rooms/{id}/read`) |
| Phone verification | Partial — OTP flow exists but SMS is never delivered |
| Get current user info (email/phone/status/verified flags) | None |
| Profile attributes / update profile / avatar | None |
| Change e-mail or phone | None |
| Account deletion/closure | None |
| PIN reset via e-mail OTP | None (security questions only) |
| Security-question catalogue | None |
| Biometric register/login/revoke protocol | None (only opaque device registry) |
| Eligible/personalised promotions | None (only `GET /promotions/active`) |
| Bonus claim/redeem | None (bonuses stay `PENDING`, no ledger credit) |
| Funding method selection / bank list / NGN name enquiry / saved beneficiaries | None |
| Funding/withdrawal fee preview | None |
| Dedicated funding/withdrawal lists | None (use `/transactions/history?type=FUNDING|WITHDRAWAL`) |
| KYC "submit for review" without ComplyCube / list/delete my documents | None |
| Notification mark-all-read / delete notification | None |
| Transaction receipts / statements export | None for customers |
| Transactions feed for P2P, cards, bonuses | None (feed covers funding, withdrawal, exchange only) |

---

## 12. Endpoint count summary

| Area | REST endpoints | Public | Admin-authority (not mobile) | Not-for-mobile ops |
|---|---|---|---|---|
| Auth | 12 | 8 | 0 | 0 |
| Profile | 2 | 0 | 0 | 0 |
| KYC | 5 | 0 | 0 | 0 |
| Security | 12 | 0 | 0 | 0 |
| Wallets | 4 | 0 | 0 | 0 |
| Funding | 5 | 0 | 0 | 3 (`process`, `fail`, `reverse`) |
| Withdrawals | 5 | 0 | 0 | 3 (`process`, `fail`, `reverse`) |
| Currencies / rates | 6 | 0 | 2 | 0 |
| Exchange | 4 | 0 | 0 | 0 |
| P2P | 8 | 0 | 0 | 0 |
| Negotiations | 7 | 0 | 0 | 0 |
| Chat REST | 6 | 0 | 0 | 0 |
| Transactions | 4 | 0 | 0 | 0 |
| Cards | 6 | 0 | 0 | 0 |
| Notifications | 8 | 0 | 0 | 0 |
| Promotions | 6 | 0 | 1 | 0 |
| **Total** | **100** | **8** | **3** | **6** |

Mobile-usable REST endpoints: 100 − 3 admin-authority − 6 ops = **91**. Plus 1 STOMP `@MessageMapping` (`/app/rooms/{roomId}/send`) and 3 server destinations (`/topic/rooms.{roomId}`, `/topic/rooms.{roomId}.reads`, `/user/queue/negotiations`). Webhooks (3) are server-to-server and excluded.
