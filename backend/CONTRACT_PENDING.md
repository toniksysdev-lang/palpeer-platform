# Unresolved API / business contracts
# Do not invent production rules until items below are confirmed.

## Phase 1 — Authentication

| ID | Topic | Question | Current provisional behavior |
|----|-------|----------|------------------------------|
| P1-01 | `User.status` catalog | Exact allowed status values? | `PENDING_VERIFICATION`, `ACTIVE`, `SUSPENDED`, `CLOSED` |
| P1-02 | Registration fields | Are email **and** phone both mandatory? | Both required (entity has both fields) |
| P1-03 | Password policy | Min length, complexity, history? | Min length 8 only (`@Size(min=8)`) |
| P1-04 | Login gate | May unverified users obtain JWTs? | Yes, if `enabled=true` |
| P1-05 | Initial `enabled` | Enabled immediately on register? | `true` on register |
| P1-06 | OTP purpose | Registration verify vs login 2FA vs both? | `EMAIL_VERIFICATION`, `PHONE_VERIFICATION`, `PASSWORD_RESET` |
| P1-07 | OTP channel / provider | SMS gateway, email provider, templates? | `OtpSender` + `LoggingOtpSender`; dev logs code when `log-code=true` |
| P1-08 | OTP length / TTL / max attempts | Exact values? | Config defaults: 6 digits / 10m / 5 attempts |
| P1-09 | JWT TTLs | Access / refresh lifetimes? | Config defaults: 15m / 14d |
| P1-10 | Password reset channel | Email OTP only, SMS, or magic link? | Email OTP |
| P1-11 | Status promotion | When does user become `ACTIVE`? | When both email and phone verified |
| P1-12 | Logout semantics | Revoke refresh only, or also access denylist? | Refresh token revoke only |

### Phase 1 validation fixes applied

- [x] Dev OTP delivery via `log-code` (dev profile)
- [x] JWT filter enforces `enabled` + handles missing user
- [x] `/otp/verify` rejects `PASSWORD_RESET`
- [x] `/otp/resend` for password-reset does not enumerate accounts
- Mobile Phase 13 uses `POST /auth/password/change` and `GET /auth/sessions` / `POST /auth/sessions/{id}/revoke` / `POST /auth/sessions/revoke-all` as-is (live-checked). Still open for the app: no account-deletion or email/phone-change endpoint (required by the App Store and Google Play before a production release), no device details on sessions, and access tokens stay valid up to 15 minutes after a session is revoked (P1-12).

## Phase 2 — Profile + KYC

| ID | Topic | Question | Current provisional behavior |
|----|-------|----------|------------------------------|
| P2-01 | Profile attributes | Name, DOB, address, nationality, etc.? | Profile stores **userId only** until catalog confirmed |
| P2-02 | Document type catalog | Allowed `documentType` values? | Free-form string (uppercased); no enum yet |
| P2-03 | KYC progress rules | Required docs, scoring, % complete? | Checklist only: hasDocument / hasSelfie / counts |
| P2-04 | Submit / review transition | Who moves case to SUBMITTED / UNDER_REVIEW? | **ComplyCube:** `POST /api/v1/kyc/verification/start` → UNDER_REVIEW; webhook/admin can APPROVE/REJECT |
| P2-09 | KYC vendor | Which identity vendor? | **ComplyCube** Pure API + webhooks (`COMPLYCUBE_*`) |
| P2-05 | Rejection model | Reason codes, resubmit rules? | Nullable `rejectionReason`; re-upload allowed from REJECTED → IN_PROGRESS |
| P2-06 | Object storage provider | S3 / GCS / Azure / other? | `ObjectStorage` + local private filesystem adapter |
| P2-07 | Upload constraints | MIME allow-list, max size, virus scan? | Multipart max 10MB; no MIME allow-list yet |
| P2-08 | Upload-allowed statuses | Which KYC statuses accept uploads? | `NOT_STARTED`, `IN_PROGRESS`, `REJECTED` only |

### Phase 2 validation fixes applied

- [x] Orphan blob cleanup on TX rollback (`TransactionSynchronization`)
- [x] GET `/kyc/status` and `/kyc/progress` no longer auto-create cases
- [x] Documented P2-08 upload gate

## Phase 3 — Security

| ID | Topic | Question | Current provisional behavior |
|----|-------|----------|------------------------------|
| P3-01 | PIN policy | Length, complexity, lockout, max attempts? | 4–8 digits; lockout after 5 consecutive failures (verify/change/reset answers) for 15 min → 423 `PIN_LOCKED`; configurable via `palpeer.security.pin.max-attempts` / `lockout-duration` (V25) |
| P3-02 | Security question catalog | Fixed list? Required count? | Free-form key/text; min 2 questions |
| P3-03 | Biometric protocol | Passkey / WebAuthn / native biometric? | Opaque `biometricCredential` stored; no challenge/verify protocol yet |
| P3-04 | PIN reset factors | Questions vs OTP vs password? | Security-question answers (authenticated session) |
| P3-05 | Answer match rule | All questions vs random subset? | All configured questions must be answered |
| P3-06 | Device limits | Max devices per user? | Unlimited |

### Phase 3 validation

- **PASS** — entities, V7, auth, PIN/questions/devices flows; no critical blockers
- [x] `resetPin` requires an existing PIN (does not create)

## Phase 4 — Currency

| ID | Topic | Question | Current provisional behavior |
|----|-------|----------|------------------------------|
| P4-01 | Rate pair model | Base/quote arbitrary pairs, or vs a single base? | `baseCurrencyCode` + `quoteCurrencyCode` |
| P4-02 | Rate/currency writers | Who may create currencies and publish rates? | `currencies:write` / `rates:write` (admin) |
| P4-03 | Buy/sell semantics | Platform buy vs customer buy perspective? | Stored as provided `buyRate` / `sellRate` |
| P4-04 | Rate precision | Decimal places for rates? | `NUMERIC(28,12)` |
| P4-05 | Effective date timezone | Instant vs local business date? | `TIMESTAMPTZ` / `Instant` |

### Phase 4 validation

- **PASS** — entities, V8, BigDecimal rates, FKs/constraints, auth; no critical blockers

## Phase 5 — Wallet + Ledger

| ID | Topic | Question | Current provisional behavior |
|----|-------|----------|------------------------------|
| P5-01 | HOLD/RELEASE semantics | Cancel hold vs settle/capture? | HOLD: available→pending; RELEASE: pending→available |
| P5-02 | Wallet uniqueness | One wallet per user per currency? | Yes (`uk_wallets_user_currency`) |
| P5-03 | Opening balance | Zero-open vs funded-on-create? | Zero; funding is Phase 6 via ledger CREDIT |
| P5-04 | Idempotency key scope | Global vs per-wallet? | Global unique `idempotency_key` |
| P5-05 | Amount scale vs currency precision | Enforce currency.precision on postings? | Not enforced yet — uses NUMERIC(28,12) |

**Invariant:** Wallet `availableBalance` / `pendingBalance` are projections updated **only** by `LedgerService.post`.

### Phase 5 validation fixes applied

- [x] Idempotent replay asserts walletId / entryType / amount match
- [x] Concurrent duplicate `idempotency_key` re-fetches instead of 500

## Phase 6 — Funding + Withdrawal

| ID | Topic | Question | Current provisional behavior |
|----|-------|----------|------------------------------|
| P6-01 | Funding provider | PSP / bank / card rails + webhooks? | **CAD → Apaylo** Interac Request Money; **NGN → Kuda** virtual account; webhooks `/api/v1/webhooks/apaylo` & `/kuda` (HMAC-signed, fail-closed); manual `process`/`fail`/`reverse` restricted to operators with `payments:operate` (V25) |
| P6-02 | Withdrawal destination | Bank account / mobile money model? | **CAD:** Interac email/phone or `institution:transit:account` EFT; **NGN:** `bankCode:accountNumber` via Kuda; else opaque `destinationReference` |
| P6-03 | State transition matrix | Who may process/fail/reverse? | Owner-authenticated; provider webhooks can complete by provider reference |
| P6-04 | Withdrawal ledger model | Direct DEBIT vs HOLD then settle? | HOLD on initiate; SUCCESS = RELEASE + DEBIT; fail = RELEASE |
| P6-05 | Idempotency header | Required name/format? | `Idempotency-Key` HTTP header (unique per movement type table) |
| P6-APAYLO-01 | Apaylo endpoint paths | Exact Merchant API paths / payload fields? | Provisional paths under `/api/Merchant/*` — confirm against live Apaylo docs once credentials issued |
| P6-APAYLO-02 | Apaylo webhook signing | Apaylo's real signature scheme and header? | Generic HMAC-SHA256 hex of raw body in `APAYLO_WEBHOOK_SIGNATURE_HEADER` (default `X-Webhook-Signature`) keyed by `APAYLO_WEBHOOK_SECRET`; blank secret rejects all |
| P6-KUDA-02 | Kuda webhook signing | Kuda's real webhook auth (signature vs basic auth)? | Same generic HMAC scheme with `KUDA_WEBHOOK_SECRET` / `KUDA_WEBHOOK_SIGNATURE_HEADER`; blank secret rejects all |
| P6-KUDA-01 | Kuda webhook auth | Signed webhooks vs IP allow-list? | Open webhook endpoint; harden once Kuda webhook contract confirmed |

### Phase 6 validation + tests

- Fixed: funding `saveAndFlush` for concurrent idempotency
- Fixed: pessimistic locks on funding/withdrawal mutate paths
- Unit tests added: `FundingServiceTest`, `WithdrawalServiceTest`, `LedgerServiceTest`
- **Runtime note:** JDK not on PATH in this environment — tests authored but not executed here

## Phase 7 — Instant Exchange

| ID | Topic | Question | Current provisional behavior |
|----|-------|----------|------------------------------|
| P7-01 | Rate side | Buy vs sell when converting A→B? | Direct pair uses `sellRate`; inverse uses `1/buyRate` |
| P7-02 | Rounding | HALF_UP vs HALF_EVEN vs floor? | `RoundingMode.HALF_EVEN` via `FixedDecimalMoney` |
| P7-03 | Quote TTL | How long is a quote valid? | Config `palpeer.exchange.quote-ttl` default 60s |
| P7-04 | Amount input | Source-only, target-only, or both? | Exactly one of sourceAmount / targetAmount |
| P7-05 | Atomicity on partial ledger failure | Compensating CREDIT if DEBIT succeeded? | TX rolls back DB; ledger posts in same TX — full rollback |

### Phase 7 validation + tests

- **PASS** — quote/calculate/execute, FixedDecimalMoney, ledger DEBIT+CREDIT, idempotency
- Unit tests: `FixedDecimalMoneyTest` (scale, convert, zero-rate guard)
- **Runtime note:** JDK not on PATH — tests not executed in this environment

## Phase 8 — P2P

| ID | Topic | Question | Current provisional behavior |
|----|-------|----------|------------------------------|
| P8-01 | Side semantics | BUY/SELL relative to which currency? | `P2PSide` BUY/SELL on request |
| P8-02 | Request attributes | Payment methods, min/max, fees? | Minimal: side, pair, amount, rate, expiresAt, notes |
| P8-03 | Settlement | When does ledger move on P2P? | Not in Phase 8 — accept only creates order |
| P8-04 | Delete semantics | Hard delete vs cancel? | Soft cancel → `CANCELLED` |
| P8-05 | Partial accept | Accept partial amount? | Full amount only |
| P8-06 | COMPLETED transition | Who completes the order? | Deferred (negotiation/chat/admin later) |
| P8-07 | Participant order list | — (resolved) | `GET /api/v1/p2p/me/orders`: orders where caller is requester or acceptor, newest first, with the request's side and currency pair |

### Phase 8 validation + tests

- **PASS** — create/update/delete/accept, pessimistic accept lock, self-accept guard
- Fixed: `getRequest` no longer `readOnly` so expiry persists
- Unit tests: `P2PServiceTest`
- **Runtime note:** JDK not on PATH — tests not executed here

## Phase 9 — Negotiation

| ID | Topic | Question | Current provisional behavior |
|----|-------|----------|------------------------------|
| P9-01 | Negotiation statuses | Full catalog? | `OPEN`, `ACCEPTED`, `CANCELLED` |
| P9-02 | When negotiation starts | Before listing accept vs after order? | Against OPEN P2P request |
| P9-03 | Offer history | Overwrite vs append? | Append `NegotiationOffer` rows; pending superseded on counter |
| P9-04 | Accept side effects | Create order? Update listing terms? | Accept → `P2PService.acceptWithTerms` + order |
| P9-05 | Turn rules | Who may counter/accept? | Cannot counter/accept own pending offer |
| P9-06 | Participant negotiation list | — (resolved, mobile Phase 9) | `GET /api/v1/negotiations/me[?p2pRequestId=]`: negotiations where caller is request owner or counterparty, newest first; with `p2pRequestId`, only that request's negotiations the caller takes part in |
| P9-07 | Reject / cancel | — (resolved, V26) | `POST /negotiations/{id}/reject` (only the participant whose turn it is; ends it) and `POST /negotiations/{id}/cancel` (either participant while OPEN). Pending offer → `REJECTED`, negotiation → `CANCELLED` with `closedReason` (`REJECTED`/`CANCELLED`) and `closedBy`. When the P2P request leaves OPEN (accepted, owner cancel, admin close, persisted expiry) its OPEN negotiations close with `REQUEST_CLOSED` (Spring event `P2PRequestClosedEvent`, same transaction). Expiry is recorded by a scheduled sweep (`P2PExpiryJob`, every 30 s, `P2P_EXPIRY_SWEEP_MS`) as well as on reads/writes |
| P9-08 | Accept result / live updates | — (resolved, V26) | `NegotiationResponse.p2pOrderId` set on accept. Every committed change is pushed to both participants on STOMP `/user/queue/negotiations` (principal name = user id) |

### Phase 9 validation + tests

- **PASS** — offer/counter/accept/cancel, history append, accept→P2P order
- Unit tests: `NegotiationServiceTest` (3), `P2PServiceTest` (4) — BUILD SUCCESS
- V26 lifecycle: `NegotiationServiceTest` (13), `NegotiationRealtimePublisherTest` (1), `P2PServiceTest` (7), `ChatServiceTest` (6), `StompAuthChannelInterceptorTest` (9); full `mvnw test` BUILD SUCCESS; 29/29 live checks (reject, cancel, auto-close on accept/owner cancel/admin close/expiry, order id, user queue privacy, read receipts)
- JDK 21 on PATH: `C:\Program Files\Microsoft\jdk-21.0.12.101-hotspot`

## Phase 10 — Chat (WebSocket / STOMP)

| ID | Topic | Question | Current provisional behavior |
|----|-------|----------|------------------------------|
| P10-01 | Room scope | P2P-order only vs free-form DM? | Room created from P2P order participants; optional `p2pOrderId` |
| P10-02 | Reconnect | Client strategy after disconnect? | SockJS `/ws`; REST history; `clientMessageId` idempotency |
| P10-03 | WS auth | Header name / query param for JWT? | STOMP CONNECT: `Authorization: Bearer` or `token` header |
| P10-04 | Topic ACL | Enforce subscribe only for participants? | Resolved (SEC-4): SUBSCRIBE `/topic/rooms.{id}` participants only; re-verified live in mobile Phase 9 |
| P10-05 | Message retention | TTL / purge / moderation? | Persist indefinitely; max content 4000 chars |
| P10-06 | Presence / typing | Required in v1? | Not implemented |
| P10-07 | Read receipts | — (resolved, V26) | `POST /chat/rooms/{id}/read {messageId}` moves the caller's `participantA/BLastReadAt` forward only (atomic update); `/topic/rooms.{id}.reads` broadcasts `{roomId, userId, lastReadAt}` to participants (subscribe ACL as for the room). Unread counts / last message not implemented |

### Phase 10 validation + tests

- **PASS** — room create, REST/STOMP send, topic receive, reconnect (SockJS + history + `clientMessageId`), JWT on CONNECT, V14
- Fixed: STOMP controller returns `void` (broadcast only via `ChatService` topic)
- Unit tests: `ChatServiceTest` (2) — BUILD SUCCESS
- ~~Open risk: subscribe ACL deferred (P10-04)~~ resolved

## Phase 11 — Transactions

| ID | Topic | Question | Current provisional behavior |
|----|-------|----------|------------------------------|
| P11-01 | Activity catalog | Which products appear in the feed? | FUNDING, WITHDRAWAL, EXCHANGE, TRANSFER, settled P2P (ACCEPTED/COMPLETED) |
| P11-02 | Detail identity | Single UUID vs type+id? | Path `/api/v1/transactions/{type}/{id}` |
| P11-03 | History pagination | SQL UNION vs merge? | In-memory merge of bounded per-source fetches |
| P11-04 | Summary metrics / window | Exact KPIs and default period? | Counts by type; status keys `TYPE:STATUS`; SUCCESS funding/withdrawal totals by currency; exchange SUCCESS count; default 30 days |
| P11-05 | Recent limit | Default / max? | Default 20, max 100 |

### Phase 11 validation + tests

- **PASS** — recent / details / history / summary; read-only; ownership on details; V15 indexes
- Fixed: `countByStatus` keys namespaced as `TYPE:STATUS` (no enum collision)
- Added: ownership-negative unit test
- Unit tests: `TransactionQueryServiceTest` — BUILD SUCCESS
- Open: in-memory history merge (P11-03); card/bonus still out of feed
- Mobile Phase 10 (Activity, transaction detail, Home recent) uses these four endpoints as-is; no backend change. Customer history has no search/status/currency filter (mobile T-1).

## Phase 12 — Notification

| ID | Topic | Question | Current provisional behavior |
|----|-------|----------|------------------------------|
| P12-01 | Device token platforms / limits | Platform catalog, provider mapping, multi-device limits? | `IOS`/`ANDROID`/`WEB`/`OTHER`; upsert by token; no max devices |
| P12-02 | Channels | Required channels in v1? | `IN_APP`, `PUSH`, `BOTH` |
| P12-03 | Status / unread | Status catalog and unread definition? | `PENDING`/`SENT`/`FAILED`/`READ`; unread = PENDING + SENT |
| P12-04 | Category / deep links | Category catalog and reference model? | Free-form `category`; optional `referenceType`/`referenceId` |
| P12-05 | Push provider | **Resolved:** FCM via Firebase Admin (`FcmPushNotifier`); stub when `palpeer.fcm.enabled=false` | Set `PALPEER_FCM_ENABLED` + service-account credentials |
| P12-06 | Who may create | System-only vs admin vs self? | `NotificationService.create` for internal callers; no public create REST yet |

### Phase 12 validation + tests

- **PASS** — DeviceToken + Notification, V16, token register/list/disable/delete, inbox list/get/read/unread-count, PushNotifier stub
- Distinct from security `Device` (biometric)
- Create REST correctly deferred (P12-06)
- Added ownership tests for get + disable token
- Unit tests: `NotificationPhase12Test` — BUILD SUCCESS
- Open risk: BOTH + push exception currently marks FAILED (confirm under P12-02/P12-03)
- Mobile Phase 12 (notification center/detail, push opt-in settings, push tap routing, deep links) uses the device-token and inbox endpoints as-is. The app registers the native FCM/APNs token with the install's `deviceIdentifier` and deletes it on sign-out. Still missing for real pushes: an FCM/APNs `PushNotifier` provider, a push `data` payload that includes `notificationId` (mobile NT-4), and events that create PUSH/BOTH notifications (only the referral EMAIL notification exists today).
- Backend fix during mobile Phase 12 (palpeer-common `GlobalExceptionHandler`): `HttpMessageNotReadableException` (malformed JSON / unknown enum in a body, e.g. an invalid device-token `platform`) now returns **400 `MALFORMED_REQUEST`** instead of 500 `INTERNAL_ERROR`; only the cause class is logged. Test: `MalformedRequestHandlingTest` — PASS.

## Phase 13 — Cards

| ID | Topic | Question | Current provisional behavior |
|----|-------|----------|------------------------------|
| P13-01 | Card status catalog | Exact statuses / provider mapping? | `PENDING`, `ACTIVE`, `BLOCKED`, `CLOSED` |
| P13-02 | Card transaction types | Auth/capture/refund catalog? | `AUTHORIZATION`, `CAPTURE`, `REFUND`, `REVERSAL`, `FEE`, `OTHER` |
| P13-03 | Tx status / transitions | Settlement state machine? | `PENDING`, `SETTLED`, `FAILED`, `REVERSED` |
| P13-04 | Product model | Virtual vs physical; funding wallet required? | Optional `walletId`; currency must match if set; no PAN stored |
| P13-05 | Ledger settlement | When to DEBIT/HOLD wallet on card spend? | `ledgerEntryId` reserved; **not auto-posted** in Phase 13 |
| P13-06 | Card provider vendor | Marqeta / Stripe Issuing / other? | `CardProvider` + `StubCardProvider` (`STUB`) |

### Phase 13 validation + tests

- **PASS** — CardProvider + stub, Card / CardTransaction, V17, issue/list/get/block/unblock/transactions
- No PAN stored (lastFour only); ledger not auto-posted (P13-05)
- Wallet currency match enforced when `walletId` set
- Added ownership-negative test for block
- Unit tests: `CardServiceTest` — BUILD SUCCESS
- Mobile Phase 11 (cards list, issue, detail with freeze/unfreeze and transactions) uses these six endpoints as-is; no backend change. The app drops `providerCardId` / `providerTransactionId` on arrival. Card funding/withdrawal, preview/fees and close remain unavailable (mobile CD-2 … CD-4).

## Phase 14 — Promotion

| ID | Topic | Question | Current provisional behavior |
|----|-------|----------|------------------------------|
| P14-01 | Promotion types | Catalog? | `REFERRAL`, `SIGNUP`, `CAMPAIGN`, `OTHER` |
| P14-02 | Referral rules | Code format, multi-use, expiry? | One OPEN code per unused invite; unique code; one apply per referee; no self-referral |
| P14-03 | Bonus settlement | When to CREDIT wallet via ledger? | Bonus created `PENDING`; `ledgerEntryId` reserved — **not auto-posted** |
| P14-04 | Who creates promotions | Admin only? | `promotions:write` (admin) |
| P14-05 | Dual-sided referral bonus | Referrer and/or referee? | Both get PENDING bonus when active REFERRAL promotion has amount |

### Email (cross-cutting)

| ID | Topic | Question | Current provisional behavior |
|----|-------|----------|------------------------------|
| P14-MAIL | SMTP provider | Confirmed smtp-pulse settings | `EmailSender` / `SmtpEmailSender`; OTP EMAIL + notification EMAIL use SMTP |

### Phase 14 validation + tests

- **PASS** — Referral / Promotion / Bonus + V18; self-referral guard; dual PENDING bonuses; no ledger invent
- SMTP wired for OTP EMAIL + notification EMAIL; password removed from committed yml (use `PALPEER_SMTP_PASSWORD` / `.env`)
- Fixed: log on referral email notify failure
- Unit tests: `PromotionServiceTest` — BUILD SUCCESS
- Mobile Phase 12 (Invite friends, bonuses, promotions list, Home promotions card) uses the five customer endpoints as-is; bonuses are shown as pending/not spendable (P14-03). Gap: there is no endpoint to deactivate or edit a promotion (mobile PR-3), so test promotions stay active until `endsAt`. The referee gets no notification when a code is applied.

## Phase 15 — Admin

| ID | Topic | Question | Current provisional behavior |
|----|-------|----------|------------------------------|
| P15-01 | Permission catalog | Exact codes? | Seeded: `users:*`, `kyc:*`, `rates:write`, `currencies:write`, `transactions:read`, `p2p:*`, `promotions:write`, `admin:manage`, `audit:read` (V20), plus ops inventory `wallets:read`, `cards:read`/`cards:write`, `negotiations:read`, `chat:read`, `notifications:read` (V21) |
| P15-02 | Admin identity | Separate login vs same user JWT? | Same platform user via `AdminUser.userId` + enriched authorities |
| P15-03 | Bootstrap | How is first admin created? | `palpeer.admin.bootstrap-email` / `ADMIN_BOOTSTRAP_EMAIL` if no enabled admin |
| P15-04 | KYC review transitions | Allowed from→to matrix? | Admin may set SUBMITTED / UNDER_REVIEW / APPROVED / REJECTED |
| P15-05 | P2P admin actions | Which statuses? | CANCELLED or COMPLETED only |
| P15-06 | Admin inventory APIs | Wallets/cards/negotiations/chat/notifications admin feed? | **Landed (read inventory):** `GET /admin/wallets[/{id}[/transactions]]`, `GET /admin/cards[/{id}[/transactions]]` + `POST …/block|unblock`, `GET /admin/negotiations[/{id}]`, `GET /admin/chat/rooms[/{id}[/messages]]`, `GET /admin/notifications`. Still pending: reports, MFA, bonus settlement, KYC doc preview, global search, dashboard aggregates, notification broadcast (P12-06) |

## Phase 16 — Audit

| ID | Topic | Question | Current provisional behavior |
|----|-------|----------|------------------------------|
| P16-01 | Action catalog | Exact action codes? | Provisional: `LEDGER_POST`, `FUNDING_*`, `WITHDRAWAL_*`, `CARD_*`, `ADMIN_*`, `SECURITY_*` |
| P16-02 | Value format | JSON vs key=value? | Compact `key=value;…` strings (no secrets/hashes) |
| P16-03 | IP / device | Proxy trust / fingerprint? | `X-Forwarded-For` first hop + `User-Agent` via `AuditContextFilter` |
| P16-04 | Who may query | Admin only? | `GET /api/v1/admin/audit-logs` requires `audit:read` |
| P16-05 | Retention | How long to keep? | Unlimited (no purge job) |

## TODO

- [ ] Confirm P1-01 … P1-12 before UAT
- [ ] Confirm P2-01 … P2-08 before UAT
- [ ] Confirm P3-01 … P3-06 before UAT
- [ ] Confirm P4-01 … P4-05 before UAT
- [ ] Confirm P5-01 … P5-05 before UAT
- [ ] Confirm P6-01 … P6-05 before UAT
- [ ] Confirm P7-01 … P7-05 before UAT
- [ ] Confirm P8-01 … P8-06 before UAT
- [ ] Confirm P9-01 … P9-05 before UAT
- [ ] Confirm P10-01 … P10-06 before UAT
- [ ] Confirm P11-01 … P11-05 before UAT
- [ ] Confirm P12-01 … P12-06 before UAT
- [ ] Confirm P13-01 … P13-06 before UAT
- [ ] Confirm P14-01 … P14-05 before UAT
- [ ] Confirm P15-01 … P15-05 before UAT
- [ ] Confirm P16-01 … P16-05 before UAT
- [ ] Rotate SMTP password (credentials were shared in chat) and use env/secrets in prod
- [ ] Replace SMS OTP placeholder with real provider once P1-07 confirmed
- [ ] Replace `LocalPrivateObjectStorage` with cloud private bucket adapter
- [ ] Replace `LoggingPushNotifier` with real push provider once P12-05 confirmed
- [ ] Replace `StubCardProvider` with real issuer once P13-06 confirmed
- [ ] Wire card settlement to ledger once P13-05 confirmed
- [ ] Wire bonus CREDIT to ledger once P14-03 confirmed
- [ ] Implement biometric challenge/verify once P3-03 confirmed
- [ ] Wire real funding/payout provider once P6-01/P6-02 confirmed — **Apaylo (CAD) + Kuda (NGN) adapters landed; enable via env credentials**
- [ ] Enable ComplyCube with sandbox API key and configure webhook URL `/api/v1/webhooks/complycube`
- [ ] Confirm production `JWT_SECRET` management (vault/KMS)
- [ ] Enforce STOMP subscribe ACL once P10-04 confirmed
- [ ] Include P2P (and others) in transaction feed once ledger-settled

## Admin ops v2 (implemented, see `docs/admin-ops-contract-v2.md` and `docs/admin-api-map.md` §15)

Read-only projections only; no new financial/eligibility rules. Provisional choices to confirm:

- Reports summary: p2p/cards/referrals/bonuses counts are all-time (contract only specifies the window for transactions).
- Global transactions merge in memory with a per-source cap of 10,000 rows (deep pages return empty items; totals exact).
- Search chat `path` is `/admin/chat/{id}` (admin UI currently has no chat detail route).
- Session and single-session revoke are not audited (contract only requires `SECURITY_PASSWORD_CHANGE`).
- Report CSV exports are not audited (not required by contract); consider auditing PII exports before production.
