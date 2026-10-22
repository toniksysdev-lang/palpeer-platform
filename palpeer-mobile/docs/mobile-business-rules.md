# PALPEER Mobile — Business Rules

Rules the mobile app must respect. Each is tagged with its source:

- **VERIFIED** — enforced in the backend code (the app mirrors it for UX but the backend stays authoritative).
- **EVIDENCE** — from APK strings/hooks; used for copy or UX only.
- **CLIENT** — a mobile-side safeguard that does not change any financial outcome. Listed so it's never mistaken for a backend rule.

Anything not here is not a rule. Unverified items live in `mobile-contract-pending.md`.

---

## 1. Global

| ID | Rule | Source |
|---|---|---|
| R-G-1 | The backend is authoritative for balances, rates, amounts, statuses, P2P/negotiation state and card state. The app never computes an authoritative financial value. | VERIFIED (architecture) |
| R-G-2 | Amounts, rates and balances are displayed exactly as returned, formatted to the currency's `precision` from `GET /currencies`. No floating-point math on money; amounts are parsed losslessly from JSON. | VERIFIED (`CurrencyResponse.precision`) |
| R-G-3 | Balances in different currencies are never added together. | CLIENT (no FX total exists in the backend) |
| R-G-4 | A money action is shown as successful only when the backend status is `SUCCESS` (funding/withdrawal/exchange). `PENDING`/`PROCESSING`/`INITIATED` show as in progress. | VERIFIED (status enums) |
| R-G-5 | `POST /funding`, `POST /withdrawals`, `POST /exchange/execute` send a new `Idempotency-Key` (UUID v4) per user intent, reused on retry of the same intent. | VERIFIED |
| R-G-6 | Mock data is never used in production builds. | CLIENT |

## 2. Authentication

| ID | Rule | Source |
|---|---|---|
| R-A-1 | Password 8–128 characters; no complexity rules on the backend. | VERIFIED |
| R-A-2 | Email is the login identifier; stored lower-cased. Phone is free text ≤ 32. | VERIFIED |
| R-A-3 | Email and phone must be unique (409 `EMAIL_ALREADY_REGISTERED` / `PHONE_ALREADY_REGISTERED`). | VERIFIED |
| R-A-4 | OTP: 6 digits, 10-minute validity, 5 attempts per challenge. Resending creates a new challenge. | VERIFIED |
| R-A-5 | Login does not require verified email/phone or KYC. After login, an unverified user is prompted to verify but is not blocked by the backend. | VERIFIED |
| R-A-6 | Access token 15 min, refresh token 14 days, rotating: after `POST /auth/refresh` the old refresh token is dead. Only one refresh call may be in flight; concurrent 401/403s wait for it. | VERIFIED |
| R-A-7 | If refresh fails: clear Secure Store, clear state, go to Login, show "Your session has expired. Please sign in again." No retry loop. | VERIFIED (prompt §16) |
| R-A-8 | Password change or reset revokes all refresh tokens; the app signs out. After an in-app change (Security → Password, current password required) the login screen says why. Passwords go through `accountCommands`, never RTK Query, so they don't enter Redux. | VERIFIED (live Phase 13) |
| R-A-10 | Active sessions = active refresh tokens (`id`, `createdAt`, `expiresAt`, `current`; no device or location data). The app sends its refresh token in `X-Refresh-Token` to mark "This phone"; it's read from Secure Store inside the request, not kept in the query cache. Ending another session asks for confirmation (an already-ended one counts as ended). Ending this phone's session or "Sign out of all devices" (includes this phone) signs out here with a login notice. Access tokens stay valid for up to 15 minutes after a session ends, and the screen says so. | VERIFIED (live Phase 13) |
| R-A-9 | Password-reset request always shows the neutral message regardless of whether the account exists. | VERIFIED |

## 3. KYC

| ID | Rule | Source |
|---|---|---|
| R-K-1 | Statuses: `NOT_STARTED`, `IN_PROGRESS`, `SUBMITTED`, `UNDER_REVIEW`, `APPROVED`, `REJECTED` (with `rejectionReason`). | VERIFIED |
| R-K-2 | Uploads are allowed only in `NOT_STARTED`, `IN_PROGRESS`, `REJECTED` (409 `KYC_UPLOAD_NOT_ALLOWED` otherwise). | VERIFIED |
| R-K-3 | Max 10 MB per file, 12 MB per request. Send JPEG/PNG (documents may be PDF). | VERIFIED (config) |
| R-K-4 | Verification uses the latest document (front only) and latest selfie. | VERIFIED |
| R-K-5 | `POST /kyc/verification/start` needs firstName, lastName (≤80); DOB `YYYY-MM-DD` and 2-letter country optional. 503 when the provider is disabled. | VERIFIED |
| R-K-6 | The app does not claim liveness detection. | VERIFIED (absent) |
| R-K-7 | KYC is not required by the backend for any money action. The app may encourage KYC but must not state it is required unless that becomes a backend rule. | VERIFIED |
| R-K-8 | The app asks for a selfie before submitting (the backend falls back to a document-only check without one). Submission is still allowed without a selfie, with a warning. | CLIENT |
| R-K-9 | Photos with a short side below 720 px (document) / 480 px (selfie) are rejected before upload; the check is resolution only — no blur/glare detection is claimed. | CLIENT |
| R-K-10 | Every photo is re-encoded to JPEG (quality 0.85) with the long side capped at 2000 px, keeping uploads well under the 10 MB limit. | CLIENT |
| R-K-11 | Selfies must come from the live front camera; documents may also come from the photo library. | CLIENT |
| R-K-12 | A new upload after REJECTED moves the case back to IN_PROGRESS; the app asks for a new document first. | VERIFIED |

## 4. Security

| ID | Rule | Source |
|---|---|---|
| R-SEC-1 | Transaction PIN is 4–8 digits (backend marks this provisional). It is never stored on the device and never logged. | VERIFIED |
| R-SEC-2 | The backend does not require a PIN on withdrawal, exchange, P2P or card issue. The app asks for PIN verification (`POST /security/pin/verify`) before withdrawal and exchange execute as a client-side safeguard, if a PIN is set. This does not replace a backend rule and is listed as pending S-1. | CLIENT |
| R-SEC-3 | Forgot PIN = answer all configured security questions + new PIN. | VERIFIED |
| R-SEC-4 | Security questions: at least 2, unique keys, answers compared trimmed and case-insensitive. Saving replaces all questions. | VERIFIED |
| R-SEC-5 | Biometrics only unlock credentials stored on this device; they are not proof of identity to the backend. | Prompt §24 + VERIFIED (no backend protocol) |
| R-SEC-6 | Never log or display passwords, OTPs, PINs, tokens, full PAN or CVV. | Prompt §48 |
| R-SEC-7 | 5 consecutive wrong PINs or wrong reset answers lock the PIN for 15 minutes (423 `PIN_LOCKED`, `lockedUntil` on `GET /security/pin`). The 5th wrong attempt itself returns 423. A correct PIN resets the count. | VERIFIED (live, Phase 5) |
| R-SEC-8 | Replacing security questions requires PIN confirmation when a PIN is set. The backend doesn't require it (see S-6), so this is a client safeguard only. | CLIENT |
| R-SEC-9 | PINs are entered on an in-app keypad (no text field, so no keyboard, suggestions or autofill). Screenshots/recording are blocked on PIN and security-question screens. PINs, answers and the device credential never enter Redux state (sent directly, not through RTK Query). | CLIENT |
| R-SEC-10 | A 401 carrying an error code (e.g. `PIN_INVALID`, `SECURITY_ANSWER_INVALID`) is a business failure and is never retried; only an expired session (403 or 401 with no body) triggers the one token refresh. Otherwise a single wrong PIN would count twice towards the lock. | CLIENT |
| R-SEC-11 | Biometric unlock is an app lock over the stored session: it's bound to the user who turned it on, asked on cold start and after ≥ 60 s in the background, with device-passcode fallback disabled; the fallback is signing in with the password. | CLIENT |
| R-SEC-12 | Turning biometric unlock on registers this install with `POST /security/devices` (a stale record with the same identifier is replaced). After each successful biometric check the app confirms the device is still registered and enabled; a disabled or removed device turns biometric unlock off and signs out. If the server can't be reached, the unlock proceeds. Signing out removes this device's record. | CLIENT |

## 5. Wallets, funding, withdrawal

| ID | Rule | Source |
|---|---|---|
| R-W-1 | One wallet per currency per user (409 `WALLET_EXISTS`). Currency must exist. | VERIFIED |
| R-W-2 | Balances: `availableBalance` and `pendingBalance`, changed only by ledger postings. | VERIFIED |
| R-W-3 | Funding method is determined by wallet currency on the backend: CAD uses Apaylo Instant Interac deposit only (`Interac, Instant deposit via Interac`), NGN uses a Kuda virtual account (show `paymentDetails` / transfer step; credit only after webhook). Other currencies have no rail. The app doesn't offer a CAD method picker. | VERIFIED |
| R-W-4 | Funding amount > 0. No min/max or fee exists on the backend. | VERIFIED |
| R-W-5 | Funding completes only via the provider (webhook). The app polls `GET /funding/{id}` and never calls `process`/`fail`/`reverse`. | VERIFIED |
| R-W-6 | Withdrawal amount > 0 and ≤ available balance (422 `INSUFFICIENT_AVAILABLE_BALANCE`). A HOLD moves the amount to pending immediately. | VERIFIED |
| R-W-7 | Withdrawal destination: CAD Interac email/phone or EFT `institution:transit:account`; NGN `bankCode:accountNumber`. | VERIFIED |
| R-W-8 | CAD `PENDING` + `APAYLO` status copy references Instant Interac deposit (send from banking app to Palpeer account — no request email). | EVIDENCE + VERIFIED |
| R-W-9 | Amount inputs accept at most the currency's `precision` decimals (from `GET /currencies`). The backend accepts more (W-7). Amounts are sent as exact JSON numbers built from the typed string, never through a JS float. | CLIENT |
| R-W-10 | Fund and Withdraw are disabled for currencies with no backend rail (anything but CAD and NGN), because such a funding can never complete and such a withdrawal would hold funds until an operator acts (W-8). | CLIENT (mirrors VERIFIED rail wiring) |
| R-W-11 | The withdrawal form blocks amounts above the displayed available balance before calling the API. The backend's 422 remains the authority and its message is shown if balances changed. | CLIENT |
| R-W-12 | One `Idempotency-Key` per funding/withdrawal intent: kept across retries (including network errors), replaced when the user goes back and edits details or the backend reports an idempotency conflict. | CLIENT (implements R-G-5) |
| R-W-13 | Balances show an "As of" time; when a refresh fails with cached data, a notice says the figures are from that time. Balances, ledger and in-progress lists are refetched once a funding/withdrawal reaches a final status. | CLIENT |
| R-W-14 | In-progress fundings/withdrawals on wallet detail come from `GET /transactions/recent?limit=50`, filtered to the wallet on the client (display only). Older in-progress items appear in Activity (filter by type). | CLIENT |

## 6. Exchange

| ID | Rule | Source |
|---|---|---|
| R-X-1 | Source and target must be different wallets with different currencies, both owned by the user. | VERIFIED |
| R-X-2 | Provide exactly one of source amount or target amount. | VERIFIED |
| R-X-3 | Rates and resulting amounts come from `POST /exchange/calculate` / `preview`. The app never multiplies amounts itself. | VERIFIED |
| R-X-4 | A quote is valid until `expiresAt` (default 60 s). Expired quotes must be refreshed; execute returns 409 `EXCHANGE_QUOTE_EXPIRED`. | VERIFIED |
| R-X-5 | No exchange fees exist. The app must not display a fee line. | VERIFIED |
| R-X-6 | Balance is checked only at execute (422). | VERIFIED |
| R-X-7 | Fewer than two wallets of different currencies shows "You need at least two different currency wallets to perform a swap." Missing rate shows "Cannot currently swap between these currencies." | EVIDENCE + VERIFIED (404 no rate) |
| R-X-8 | Execute posts the DEBIT and CREDIT in one database transaction and returns `SUCCESS`; on any error nothing moves and the quote stays `OPEN` (so a 422 can be retried on the same quote). Replaying the same key + quote returns the same exchange; a used quote gives 409 `EXCHANGE_QUOTE_NOT_OPEN`. | VERIFIED (code + live) |
| R-X-9 | The form blocks a send amount above the displayed available balance before preview. The backend's 422 at execute remains the authority. | CLIENT |
| R-X-10 | One `Idempotency-Key` per quote: reused when the same quote is retried, new for every new quote. | CLIENT (implements R-G-5) |
| R-X-11 | Amount inputs are limited to the currency precision, so the backend's half-even scaling doesn't change what was typed; a re-quote resends the typed side (source or target) with the quoted amount. | CLIENT |
| R-X-12 | Rates are displayed with up to 6 decimals, rounded half-even for reading only; amounts use the currency precision. The quote countdown uses the device clock; a 409 from the backend is handled the same as a local expiry. | CLIENT |

## 7. P2P, negotiation, chat

| ID | Rule | Source |
|---|---|---|
| R-P-1 | Request fields: side (BUY/SELL), base ≠ quote currency, amount > 0, rate > 0, optional future expiry, notes ≤ 500. | VERIFIED |
| R-P-2 | Only the owner can edit or cancel, and only while `OPEN`. | VERIFIED |
| R-P-3 | A user can't accept or negotiate on their own request. | VERIFIED |
| R-P-4 | Accepting creates an order in `ACCEPTED`. No customer action moves it further. | VERIFIED |
| R-P-5 | P2P does not move money through Palpeer (no escrow, hold or settlement). The app must say so on order screens and must not show balances changing. | VERIFIED |
| R-P-6 | The meaning of BUY vs SELL relative to base/quote is not defined by the backend (P8-01). The UI labels it as "I want to buy/sell {base} for {quote}" pending confirmation. | Pending P-1 |
| R-P-7 | An `OPEN` request whose `expiresAt` has passed is treated as `EXPIRED` (backend `refreshExpiry` on access; the marketplace list filters it out). The app shows it as Expired and hides Accept/Edit/Cancel. | VERIFIED |
| R-P-8 | Marketplace filter (side, currency on either side of the pair, search on codes/notes) and sort (newest, rate, amount) run on the device with decimal comparisons; the backend list has no parameters. | CLIENT (P-4) |
| R-P-9 | Accept asks for confirmation but not a PIN: accepting moves no money and the backend requires none. | CLIENT |
| R-P-10 | Create/edit inputs: amount limited to the base currency's precision, rate to 6 decimals (the display precision; backend stores 12). Expiry is chosen from presets (1 h, 24 h, 3 d, 7 d) or none; once set it can be moved but not cleared (backend). Edit sends only changed fields; clearing notes sends `""`. | CLIENT / VERIFIED |
| R-P-11 | A user's orders come from `GET /p2p/me/orders`; an accepted request links to its order by `requestId`. Order currencies come from the order summary or its request. | VERIFIED |
| R-N-1 | One open negotiation per request per counterparty (409 `NEGOTIATION_EXISTS`). | VERIFIED |
| R-N-2 | Participants take turns; only the party who didn't make the current offer can counter or accept. | VERIFIED |
| R-N-3 | A negotiation ends as `ACCEPTED` or `CANCELLED`. `CANCELLED` carries `closedReason`: `REJECTED` (the participant whose turn it was declined; `NEGOTIATION_CANNOT_REJECT_OWN` otherwise), `CANCELLED` (either participant withdrew, any turn) or `REQUEST_CLOSED` (the request was accepted, cancelled, expired or closed by an admin). In every case the pending offer becomes `REJECTED`. The app confirms Decline and Cancel, and says who ended it and why. | VERIFIED |
| R-N-4 | Accepting creates the P2P order with the offer's terms, so it needs the request to still be OPEN (409 `P2P_NOT_OPEN` otherwise). The app hides Accept when the request isn't OPEN; countering stays available because the backend allows it. The owner can't offer on their own request. | VERIFIED |
| R-N-5 | Negotiation changes arrive live on `/user/queue/negotiations` while a negotiation screen, the P2P history or a request detail is open; each push replaces the cached negotiation (exact decimals) and refreshes the lists, and an accept or request close also refreshes the request and orders. After every reconnect negotiations are re-read. Only while live updates are down does an open negotiation's detail re-read every 15 s. "View order" uses `p2pOrderId`, falling back to matching my orders by request for older negotiations. | CLIENT (events VERIFIED) |
| R-N-6 | A new offer starts from the request's posted amount and rate; amount and rate must be above zero and are sent as exact decimals. | CLIENT (limits VERIFIED) |
| R-C-1 | Chat exists only for a P2P order, between its two participants. Message ≤ 4000 characters. | VERIFIED |
| R-C-2 | Each message carries a `clientMessageId`; resending the same id returns the original message (dedupe) without a second broadcast. A failed message keeps its id, so retrying can't duplicate it. | VERIFIED |
| R-C-3 | One app-wide STOMP connection (screens never open sockets). It connects only while signed in, online and with a chat room or negotiation view open; drops after 30 s in the background; reconnects with backoff (1 s → 30 s) and a fresh token; re-subscribes rooms and re-reads history after every reconnect and on return to the foreground. | CLIENT |
| R-C-4 | Messages are sent over REST (STOMP sends report no errors) and received over STOMP; a message is shown once even if it arrives both ways (matched by id and `clientMessageId`). Unsent messages are kept in memory only and cleared on sign-out. | CLIENT |
| R-C-5 | Read receipts: while a room is open, the newest message from the other person that my marker hasn't reached is reported once (`POST /chat/rooms/{id}/read`); a report that fails (network or server error, not a 4xx refusal) is retried after 5 s, on reconnect, and when the device comes back online; the server only moves markers forward and broadcasts the change on `/topic/rooms.{id}.reads`. "Seen" appears under my newest message once the other person's marker is at or after its time. Markers compare as times, never backwards, even if a receipt beats an older response. Typing, presence and unread counts are not offered. | VERIFIED (display CLIENT) |

## 8. Transactions

| ID | Rule | Source |
|---|---|---|
| R-T-1 | Activity covers FUNDING, WITHDRAWAL, EXCHANGE only. | VERIFIED |
| R-T-2 | Funding/withdrawal statuses: INITIATED, PENDING, PROCESSING, SUCCESS, FAILED, REVERSED. Exchange: INITIATED, SUCCESS, FAILED. No "Cancelled" status exists for these; the UI never shows one. | VERIFIED |
| R-T-3 | History page size 1–100 (default 20); summary defaults to the last 30 days. The app pages 20 at a time ("Load more" while `page + 1 < totalPages`) and asks the summary from `1970-01-01T00:00:00Z` for "All time". Items repeated across pages (new items arriving between loads) are shown once, keyed by type + id. | VERIFIED (paging CLIENT) |
| R-T-4 | Transaction detail comes from `GET /transactions/{type}/{id}`. Progress shows "Requested" (`createdAt`), the ledger steps the backend recorded (`ledgerEntryIds` keys: funding `credit`/`reversal`; withdrawal `hold`/`debit`/`release`/`reversal`; exchange `debit`/`credit`) and the latest status with `updatedAt` once final. The steps carry no times of their own (none are returned). | VERIFIED (labels CLIENT) |
| R-T-5 | While in progress the detail is re-read every 5 s (30 s for an INITIATED funding/withdrawal, which only moves through an operator or provider); a status reaching final refreshes the wallet balances. | CLIENT |
| R-T-6 | Summary money totals are the backend's completed funding and withdrawal totals, one line per currency, never added across currencies (R-G-3). The only client arithmetic is adding in-progress *counts* from `countByStatus`. | VERIFIED (counts CLIENT) |
| R-T-7 | Rows show amounts without a +/− sign: whether money moved depends on the status shown beside it. Exchanges show "source → target" amounts. | CLIENT |
| R-T-8 | Periods (7/30/90 days) are computed from the device clock when chosen and sent as `from`; `to` is left to the backend default (now + 1 day). | CLIENT |

## 9. Cards

| ID | Rule | Source |
|---|---|---|
| R-CD-1 | Only `lastFour`, brand, expiry, cardholder name and status are shown. No PAN/CVV. | VERIFIED |
| R-CD-2 | Freeze = block, unfreeze = unblock. A closed card can't be blocked (409 `CARD_CLOSED`). | VERIFIED |
| R-CD-3 | Optional linked wallet must be the user's and the same currency. | VERIFIED |
| R-CD-4 | The backend issuer is a stub. Any card with `providerName: "STUB"` shows a "Test card" label on its face and a notice on its detail screen, in every environment. | VERIFIED |
| R-CD-5 | Freezing asks for confirmation only. Unfreezing asks for confirmation and, when a PIN is set, the transaction PIN via `POST /security/pin/verify` (client-side safeguard; the server does not require it). | CLIENT |
| R-CD-6 | `providerCardId`, `providerTransactionId` and `ledgerEntryId` are dropped in `cardApi` `transformResponse`, so they never reach the cache, the UI or logs. Nothing card-related is persisted to storage. | CLIENT |
| R-CD-7 | Refunds and reversals are shown as credits (`+`); other card entries as debits. Amounts come from the backend as exact decimal strings. | CLIENT |
| R-CD-8 | The linked-wallet option is only offered when the user has a wallet in the chosen currency; it is off by default. Cardholder name is optional, trimmed, ≤ 120 characters. | VERIFIED |

## 10. Notifications, referrals

| ID | Rule | Source |
|---|---|---|
| R-NT-1 | Notification payloads are never trusted as financial data; tapping refetches from the API. | Prompt §47 |
| R-NT-2 | Push permission is requested in context (e.g. after first transaction or from settings), not at launch. | Prompt §40 |
| R-NT-3 | Backend push delivery is a logging stub. Device tokens are registered, but pushes won't arrive until FCM/APNs is integrated. While the app is open, a push shows an in-app toast (no system banner or sound; it stays in the system list) and refreshes the unread badge and notification list. | VERIFIED (stub) / CLIENT |
| R-NT-4 | Tapping a push (app in background or closed) queues one destination: `notificationId` → notification detail, else a mapped `referenceType`, else the notification center. It opens once the signed-in navigator is mounted, after sign-in if needed; the launch notification is opened once even if the OS also delivers it to the listener. Other action buttons are ignored. | CLIENT (payload NT-4) |
| R-NT-5 | Push is opt-in per install from Notification settings. The native FCM/APNs token is registered with `platform` and the install's `deviceIdentifier`; the backend record id is kept in Secure Store. The registration is refreshed after sign-in and when the OS rotates the token, removed when the phone-level permission was revoked, and deleted (best effort) on sign-out so the next person on the phone doesn't get the previous user's pushes. | CLIENT (endpoints VERIFIED) |
| R-NT-6 | Links and notification destinations go through an allowlist (`services/navigation/deepLinks.ts`): only listed screens, ids must be UUIDs, transaction types must be `FUNDING`/`WITHDRAWAL`/`EXCHANGE`, and the only query kept is a well-formed referral `code`. Anything else just opens the app. | CLIENT |
| R-NT-7 | Unread = `PENDING` + `SENT` (same as the backend count). Opening a notification marks it read; notifications with `referenceType: REFERRAL` open Invite friends, others open their detail. No mark-all-read or delete (NT-2). | VERIFIED |
| R-RF-1 | Referral codes are single-use (`REF` + 10 hex). A user can apply one code, not their own. | VERIFIED |
| R-RF-2 | Bonuses are shown with their status; `PENDING` bonuses are not presented as spendable. | VERIFIED |
| R-RF-3 | Applying a code asks for confirmation (one code per user). A referral link only pre-fills the code; it is never applied automatically. Input is upper-cased and spaces removed; the backend is case-insensitive. | CLIENT |
| R-RF-4 | "Friends who joined" lists only codes someone used (`refereeUserId` set); the referee's identity isn't shown. Sharing uses the system share sheet with the code and a `palpeer://referrals?code=` link. | CLIENT |
| R-PR-1 | Promotions list `GET /promotions/active` as-is (not personalised, PR-1); bonus amounts are exact decimals formatted in the bonus currency; referral promotions link to Invite friends. Home shows a promotions card only when at least one is active. | VERIFIED |

## 11. Profile, settings, privacy, support

| ID | Rule | Source |
|---|---|---|
| R-SP-1 | Support email/phone and privacy-policy/terms links come only from build config (`EXPO_PUBLIC_SUPPORT_EMAIL`, `EXPO_PUBLIC_SUPPORT_PHONE`, `EXPO_PUBLIC_PRIVACY_POLICY_URL`, `EXPO_PUBLIC_TERMS_URL`). Malformed values and non-https links are dropped. Anything missing shows "not available in this version of the app yet"; no placeholder contacts. | CLIENT (SP-1) |
| R-SP-2 | FAQ answers describe only screens and rules that exist in the app or are verified in the backend. No fees, limits or processing times are stated. Product must approve the wording (SP-1). | CLIENT |
| R-SP-3 | Support emails are pre-filled with the app version, platform and non-production environment only, plus a reminder not to send passwords, PINs, codes or card numbers. No user id, email or token is added. Help reminds users that nobody from support will need their password, PIN or codes. | CLIENT |
| R-SP-4 | Help & support is reachable signed out (login → "Need help?") as well as from Profile and Settings. | CLIENT |
| R-SP-5 | No support tickets or support chat: there is no API for them (SP-2). | VERIFIED |
| R-PV-1 | The Privacy screen never requests permissions. It explains each one the app declares (camera and photos for KYC, biometrics for unlock, notifications) and opens the phone's settings to change them. Location, contacts and microphone are not used (microphone is blocked in the Android manifest). | CLIENT |
| R-PV-2 | Account deletion isn't available in the app (U-4). The Privacy screen says so and, if a support email is configured, opens an "Account deletion request" email. | CLIENT (U-4) |
| R-PV-3 | Legal pages open in the system browser (no WebView). | CLIENT |
| R-ST-1 | Appearance (system/light/dark) lives in Settings, alongside app version and links to Notifications, Security, Privacy and Help. | CLIENT |
