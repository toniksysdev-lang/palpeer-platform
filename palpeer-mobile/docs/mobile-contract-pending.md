# PALPEER Mobile — CONTRACT_PENDING Register

Everything the mobile app needs that the backend does not verifiably provide. Each item says what the app does meanwhile. None of these will be faked. IDs in brackets (P8-01 etc.) refer to the backend's own `CONTRACT_PENDING.md` where one exists.

**Blocking** means the feature can't be shipped as a real feature until resolved. **Workaround** means the app ships a limited, honest version.

---

## A. Backend security fixes (blocking for any production release)

| ID | Item | Needed | Meanwhile |
|---|---|---|---|
| SEC-1 | ~~Funding and withdrawal `process`/`fail`/`reverse` callable by customers~~ | **RESOLVED (V25).** Now require `ROLE_ADMIN` + `payments:operate`; act by id and audit the operator. | App never calls them. |
| SEC-2 | ~~Payment webhooks public and unsigned; missing status = success~~ | **RESOLVED.** HMAC-SHA256 of the raw body required (`APAYLO_WEBHOOK_SECRET` / `KUDA_WEBHOOK_SECRET`); no secret = reject all. Missing/pending status = no state change. Exact provider header/scheme still to confirm (P6-APAYLO-02, P6-KUDA-02). | — |
| SEC-3 | ~~ComplyCube webhook signature optional~~ | **RESOLVED.** Signature always required; blank secret rejects all. | — |
| SEC-4 | ~~STOMP SUBSCRIBE not authorized~~ | **RESOLVED.** SUBSCRIBE `/topic/rooms.{id}` and `/topic/rooms.{id}.reads` = participants only; `/user/queue/**` allowed (scoped to the session user, whose principal name is the user id); everything else denied. SEND only to `/app/**` (no spoofed broadcasts). | App only subscribes to its own rooms and its own queue. |
| SEC-5 | ~~PIN verify has no lockout~~ | **RESOLVED (V25).** 5 consecutive wrong PINs (or wrong reset answers) → 423 `PIN_LOCKED` for 15 min (configurable, provisional P3-01). `GET /security/pin` now returns `lockedUntil`. | App shows the lock state from `lockedUntil` / `PIN_LOCKED`. |
| SEC-6 | Expired token returns 403 with empty body | Return 401 `TOKEN_EXPIRED` | App treats empty-body 403 on authenticated calls as a refresh trigger. |
| SEC-7 | Missing `Idempotency-Key`, bad JSON, bad enum return 500 | Return 400 | App always sends valid requests; 500 shown as generic error. |

## B. Account and profile

| ID | Item | Status | Meanwhile |
|---|---|---|---|
| U-1 | "Get current user" (email, phone, status, verification flags) | No endpoint | Profile shows the login email kept locally and KYC status. Verification prompts are based on the OTP flow the user completed on this device. |
| U-2 | Profile fields (name, DOB, address, avatar) and update | No fields (P2-01) | Personal-info screen is a PENDING shell. |
| U-3 | Phone verification SMS delivery | SMS placeholder | Phone verify screen is skippable and labelled. |
| U-4 | Change email/phone, account deletion | No endpoint | Privacy → "Delete your account" explains it can't be done in the app and opens an "Account deletion request" email to support when a support email is configured. FAQ says to contact support for detail changes. **Blocking for store release:** Apple and Google require in-app account deletion, so the backend needs a deletion endpoint (or an approved web flow) before Phase 17 production builds. |
| U-6 | Session device details | `SessionResponse` has only `id`, `createdAt`, `expiresAt`, `current` | Sessions are labelled "This phone" / "Session N" with sign-in and expiry times. Device name, platform or last-active time would need backend fields. |
| U-7 | Immediate sign-out of other devices | Access tokens aren't revocable (valid up to 15 min after a session ends or the password changes) | The Active sessions screen says so. Backend would need token revocation or a short access-token lifetime check. |
| U-5 | Is verification or KYC required before money actions? | Not enforced | App doesn't gate; decision needed. |

## C. KYC

| ID | Item | Status | Meanwhile |
|---|---|---|---|
| K-1 | Accepted document types list | Free text; ComplyCube mapping only | App offers PASSPORT, DRIVING_LICENSE, NATIONAL_ID, RESIDENCE_PERMIT; needs confirmation per country. |
| K-2 | Document back side | No `side` field | Front only. |
| K-3 | Submit for review without ComplyCube | No endpoint | Submit returns 503 in dev; app shows "Verification isn't available yet". |
| K-4 | Challenge liveness (blink/turn SDK) | Not in Pure API path | Live photo via front camera is required for ComplyCube `identity_check`; device challenge liveness still needs a native SDK. |
| K-5 | List/delete my uploaded documents | No endpoint | Progress counts only. |
| K-6 | Multipart request with no `file` part | Returns 500 `INTERNAL_ERROR`, not 400 `FILE_REQUIRED` (missing-part exception unhandled) | App always sends a file; backend should map `MissingServletRequestPartException` to 400. |
| K-7 | 503 `KYC_PROVIDER_DISABLED` message text names env vars (`COMPLYCUBE_ENABLED`, `COMPLYCUBE_API_KEY`) | Config detail exposed to customers | App shows its own copy for this code; backend message should be generic. |

## D. Security and biometrics

| ID | Item | Status | Meanwhile |
|---|---|---|---|
| S-1 | PIN required for money actions | Not enforced by backend | Client-side PIN step before withdrawal/exchange (CLIENT rule R-SEC-2). Backend enforcement needed. |
| S-2 | PIN reset by email/OTP (`/users/verifyPinForgotPinEmail` in APK) | No endpoint | Security-question reset only. |
| S-3 | Security question catalogue | No endpoint | App-supplied list (needs product approval of the wording). |
| S-4 | Biometric register/login protocol (`/biometric/**` in APK) | No endpoint | Device-local app lock over the stored session (R-SEC-11). `POST /security/devices` records the device; the app sends a random `biometricCredential` it doesn't keep, because the backend never uses it. A real protocol (challenge signed by a device key) is needed before biometrics can sign in without a stored session. |
| S-5 | PIN length final value | Provisional 4–8 (P3-01) | PIN input supports 4–8, default 4 or 6 to be decided. |
| S-6 | Replacing security questions needs no PIN or re-authentication | `PUT /security/questions` accepts any valid session | Anyone holding a session (e.g. an unlocked phone) can replace the questions, then reset the PIN with their own answers. App asks for the PIN first (R-SEC-8), but the backend should require the current PIN or password. |
| S-7 | Device disable/remove isn't enforced by the backend | Devices are records only; nothing checks them | The app checks its own record after every biometric unlock (R-SEC-12). `lastUsedAt` is never set, so it isn't shown. |
| S-8 | Reset with an empty answers list | Returns 400 `VALIDATION_FAILED` before the questions check | App never sends it (shows "no questions" first). |

## E. Wallets, funding, withdrawal

| ID | Item | Status | Meanwhile |
|---|---|---|---|
| W-1 | Wallet deletion | No endpoint | Not shown. |
| W-2 | Funding/withdrawal fee and limits preview (`getWalletTransactionPreview`) | No endpoint | No fee line; amount only. |
| W-3 | Funding method list for currencies other than CAD/NGN | No rail | "Funding isn't available for this currency yet." |
| W-4 | NGN bank list and name enquiry for withdrawal | Server-side only | User types bank code + account number; backend validates. |
| W-5 | Saved beneficiaries | No endpoint | Not shown. |
| W-6 | Rails disabled in dev | Config | Funding stays `INITIATED` in dev; the status screen says funding isn't available for that currency. |
| W-7 | Amount precision not validated | Backend stores up to 12 decimals and accepts any scale | App limits input to currency `precision` (R-W-9). Backend should reject amounts finer than the currency precision. |
| W-8 | Rail availability not exposed | Rails are hard-wired by currency and can be disabled by config; no endpoint says whether one is enabled. A withdrawal on a disabled rail still places a HOLD and stays `PENDING` until an operator fails it. | App offers funding/withdrawal only for CAD/NGN (R-W-10). Needs e.g. `GET /payment-methods?currency=`. |
| W-9 | Blank CAD withdrawal destination | Backend defaults to the user's own email | App always requires an explicit destination. |
| W-11 | Missing `Idempotency-Key` on `POST /funding` returns 500 (seen live) | Should be 400 | App always sends the header. |
| W-12 | Balances serialised as `BigDecimal` scientific notation (`0E-12`) on `GET /wallets/{id}`, plain `0` on create | Inconsistent number format | Client decimal parsing accepts exponent form; covered by tests. |
| W-10 | Wallet-scoped movement list | `/transactions/recent` has no wallet filter | Wallet detail filters the newest 50 client-side (R-W-14). |

## F. Exchange and rates

| ID | Item | Status | Meanwhile |
|---|---|---|---|
| X-1 | Customer all-pairs rate list (`getAllSwapRate`) | Admin-only | Rates board PENDING; per-pair rate via calculate. |
| X-2 | Minimum exchange amount ("Minimum Exchange Amount exceeds your wallet balance") | No minimum on backend | String not used. |
| X-3 | Exchange rate rule (sell vs inverse buy) | Provisional P7-01 | Displayed as returned. |
| X-4 | Buy/sell meaning on published rates | P4-03 | Rates screen shows both under the backend names; the Exchange screen shows the rate actually applied. |
| X-5 | Missing `Idempotency-Key` on `POST /exchange/execute` returns 500 (seen live) | The service's own 400 `IDEMPOTENCY_KEY_REQUIRED` is unreachable because the header is required by Spring first | App always sends the header. |
| X-6 | 404 on calculate/preview doesn't say why | Same `RESOURCE_NOT_FOUND` code for "no rate" and "wallet not found" | App only sends the user's own wallets, so it treats 404 as no rate. A distinct code (e.g. `EXCHANGE_RATE_NOT_FOUND`) would remove the guess. |
| X-7 | Quote TTL isn't returned as a duration and there's no server time | `expiresAt` only | Countdown uses the device clock; backend 409 is the fallback. |
| X-8 | No customer exchange history endpoint apart from the unified feed | `/transactions/*` | Exchange history is shown in Activity (type filter "Exchanges"). |

## G. P2P, negotiation, chat

| ID | Item | Status | Meanwhile |
|---|---|---|---|
| P-1 | BUY/SELL semantics, and which way the rate reads | P8-01 | Neutral labels ("You want to sell USD for NGN"). Rate shown as "1 {base} = {rate} {quote}" and entered as "{quote} for 1 {base}"; confirm this reading. |
| P-2 | Escrow/settlement, order lifecycle (paid, release, complete, dispute, cancel) | None (P8-03) | Order screen explains no money moves through Palpeer for P2P yet. |
| P-3 | ~~List my orders~~ | Resolved in Phase 8: `GET /p2p/me/orders` added (participant orders + request pair/side) | History → Orders tab; request detail links to its order. |
| P-4 | Server-side filter/paging for marketplace | No params | Client-side filter. |
| P-5 | P2P rate reference (`getAllP2pRate`) | No endpoint | Not shown. |
| P-6 | Payment method on requests | No field | Not shown. |
| P-7 | Counterparty identity on requests/orders | Only `userId` is exposed (no display name, no rating) | Shows "You" for own items; others are anonymous. |
| P-8 | Stored vs effective expiry in `GET /p2p/me/requests` | Returns stored `OPEN` for past-expiry requests | App shows `Expired` when `expiresAt` has passed (mirrors the backend's on-access rule). |
| N-1 | ~~List my negotiations~~ | Resolved in Phase 9: `GET /negotiations/me[?p2pRequestId=]` added (participant negotiations, newest first) | History → Offers tab; owner's request detail lists its offers; non-owner gets "View your offer". |
| N-2 | ~~Reject/cancel negotiation~~ | **RESOLVED (V26).** `POST /negotiations/{id}/reject` (only on your turn; ends it) and `POST /negotiations/{id}/cancel` (either participant while OPEN). Both set the pending offer REJECTED and the negotiation CANCELLED with `closedReason` + `closedBy`. When the request leaves OPEN (accepted, cancelled by owner, expired, closed by admin) its OPEN negotiations close with `REQUEST_CLOSED`. | "Decline offer" on your turn and "Cancel negotiation" while waiting, both confirmed; ended negotiations explain who ended them and why (R-N-3). |
| N-2a | Request expiry timing — **RESOLVED** | A scheduled sweep marks OPEN requests past `expiresAt` EXPIRED every 30 s (`P2P_EXPIRY_SWEEP_MS`) and closes their negotiations (`REQUEST_CLOSED`, pushed over realtime) | A negotiation can show OPEN for up to one sweep interval after `expiresAt`; the app already hides Accept once `expiresAt` passes (R-N-4). |
| N-3 | ~~Accepting a negotiation doesn't return the created order id~~ | **RESOLVED (V26).** `NegotiationResponse.p2pOrderId` is set on accept. | "View order" uses it; negotiations accepted before V26 have none and fall back to `GET /p2p/me/orders` (match `requestId`). |
| N-4 | ~~No realtime events for negotiations~~ | **RESOLVED.** Every committed change is pushed to both participants on `/user/queue/negotiations` (raw `NegotiationResponse`). | Negotiation detail, P2P history and request detail listen while on screen; polling (15 s) only runs while live updates are down (R-N-5). |
| C-1 | Chat before an order exists (during negotiation) | Rooms are per order | Negotiation screen has no chat. |
| C-2 | Presence, typing, unread counts, last message | None (read receipts **RESOLVED (V26)**: `POST /chat/rooms/{id}/read`, `participantA/BLastReadAt` on the room, `/topic/rooms.{id}.reads`) | Chat shows "Seen" under your latest message once the other person has read it (R-C-5). Typing, presence, unread counts and last message are not shown; the room list shows the order pair and start date. |
| C-3 | STOMP send errors not reported; no heartbeats | Gap | Send via REST for confirmation; STOMP for receive only. Without heartbeats a silently dead socket is only noticed on close, network change or foreground; history is re-read then. |

## G2. Transactions (Activity)

| ID | Item | Status | Meanwhile |
|---|---|---|---|
| T-1 | Search and status / currency / wallet filters on the customer history | `GET /transactions/history` takes only `type`, `from`, `to`, `page`, `size` (status and currency filters exist on the admin search only) | Activity offers type and period filters only. No client-side search over loaded pages, since it would silently miss older ones. |
| T-2 | P2P orders, card transactions and bonuses in the feed | Feed covers funding, withdrawal, exchange only (P11-01) | Activity says so and links to P2P history; cards and bonuses get their own screens in later phases. |
| T-3 | Per-step times | `ledgerEntryIds` carries ids only | Progress lists recorded steps without times; the final status shows `updatedAt`. |
| T-4 | Provider / instructions / destination in the unified item | Not in `TransactionItemResponse` | Detail links to the funding or withdrawal status screen, which has them. |
| T-5 | Deep history performance | Backend merges up to `(page + 1) × size` rows per source in memory (P11-03) | 20 per page; fine for normal histories. |

## H. Cards

| ID | Item | Status | Meanwhile |
|---|---|---|---|
| CD-1 | Real issuer | Stub | "Test card" label whenever `providerName` is `STUB` (R-CD-4). |
| CD-2 | Card preview/fees, type (virtual/physical) | None | Not shown; the issue flow is currency + optional wallet + optional name, then a confirmation. |
| CD-3 | Fund card / withdraw from card | None; cards aren't linked to the ledger | Card detail says these aren't available yet. No buttons. |
| CD-4 | Close card | Status exists, no endpoint | Not shown. Closed cards render greyed out with no actions. |
| CD-5 | Server-side PIN / step-up for unfreeze | Not enforced | Client asks for the PIN (R-CD-5). |
| CD-6 | Secure PAN/CVV reveal | None (by design) | Only `•••• lastFour`. If added, it needs a short-lived, screenshot-protected view. |

## I. Notifications, promotions, support

| ID | Item | Status | Meanwhile |
|---|---|---|---|
| NT-1 | Push delivery (FCM/APNs) | **Implemented:** Firebase Admin `FcmPushNotifier` when `PALPEER_FCM_ENABLED=true`; otherwise logging stub | Wire Firebase service-account credentials (see `docs/push-fcm-setup.md`). |
| NT-2 | Mark all read, delete | None | Per-item read only. |
| NT-3 | Notification categories → deep-link mapping | Free text (`REFERRAL` only today) | `REFERRAL` → Invite friends; anything else → notification detail. Map new `referenceType` values as they are introduced. |
| NT-4 | Push payload format | **Defined:** FCM data includes `notificationId`, `referenceType`, `referenceId`, `category` | App already routes on these fields and refetches (R-NT-4). |
| NT-5 | Push credentials in the build | Scaffolded (`google-services.json` / `GoogleService-Info.plist` via `app.config.ts`) | Drop real Firebase client files (gitignored) or set `GOOGLE_SERVICES_JSON` / `GOOGLE_SERVICES_PLIST` for EAS. Without them "turn on" shows unavailable. |
| NT-6 | Which events notify users | Only "Referral completed" to the referrer, channel `EMAIL` | It still appears in the center and counts as unread. No funding/withdrawal/P2P/KYC notifications exist, so the Gate 12 push paths are verified with simulated OS events in tests, not end-to-end. |
| NT-7 | Live notification updates | None (no STOMP topic) | Unread count refreshes on screen focus, app foreground and when a push arrives. |
| PR-1 | Eligible/personalised promotions | None | Active list only. |
| PR-2 | Bonus payout | None (P14-03) | Bonuses shown as pending. |
| PR-3 | Deactivate / edit a promotion | No endpoint (create only) | Test promotions created in dev stay active until their `endsAt`. |
| SP-1 | Support content, contact details, legal links | Not supplied | Build config `EXPO_PUBLIC_SUPPORT_EMAIL`, `EXPO_PUBLIC_SUPPORT_PHONE`, `EXPO_PUBLIC_PRIVACY_POLICY_URL`, `EXPO_PUBLIC_TERMS_URL` (https only). Unset → the app says they aren't available yet; no placeholders in any build. FAQ wording (`features/support/faq.ts`) describes verified behaviour only and needs product/legal approval. |
| SP-2 | Support tickets / chat | None | Not shown. Contact is email/phone only. |

## J. Configuration and release

| ID | Item | Needed |
|---|---|---|
| CFG-1 | Production and staging API/WS URLs | Values for `EXPO_PUBLIC_API_BASE_URL`, `EXPO_PUBLIC_WS_URL`. Must be `https` (API) and `https`/`wss` (WS); staging/production builds fail otherwise. |
| CFG-2 | Android package / iOS bundle id | **Resolved:** `com.palpeer.app` for Android and iOS. The app has not been published, so there is no existing listing to migrate. Keep this ID fixed; changing it after release creates a separate app. |
| CFG-3 | Expo account / EAS project, Apple and Google developer accounts | Owner access |
| CFG-4 | Brand assets (logo, icon, splash) | Source files |
| CFG-5 | Firebase project (`google-services.json`, APNs key) | For push |
| CFG-6 | Support email/phone, privacy policy and terms URLs | Values for the SP-1 build variables per environment |
| CFG-7 | Android app-wide screenshot blocking | Product decision. Today capture is blocked on secret-entry screens only, so balances can appear in the Android recents thumbnail and in user screenshots. Blocking app-wide also stops users from screenshotting receipts. iOS already blurs the app-switcher snapshot while signed in. |
