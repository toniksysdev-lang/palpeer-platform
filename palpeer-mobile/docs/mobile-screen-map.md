# PALPEER Mobile — Screen Map

Every screen the app will have, which verified endpoint backs it, and what is CONTRACT_PENDING. Routes use Expo Router file paths (see `mobile-architecture.md`). Endpoint paths are relative to `/api/v1`.

Status legend: **LIVE** = fully backed by a verified endpoint. **PARTIAL** = screen works but part of it is pending. **PENDING** = UI shell only, clearly labelled "not available yet"; no fake behaviour.

The existing APK had no screen list available as a binary, so screen names come from the master spec, APK strings and hook names.

---

## 1. Launch and onboarding (public)

| Screen | Route | Backing | Status | Notes |
|---|---|---|---|---|
| Splash | `app/_layout.tsx` (`BrandSplash` while bootstrapping) | Secure Store read + `POST /auth/refresh` | LIVE | Restores session with the stored refresh token. 8 s hard timeout falls through to Welcome so it never hangs. Unreachable server keeps the stored session. `app/index.tsx` redirects signed-out users to `/welcome` (not Login). |
| Welcome | `app/index.tsx` + `app/(onboarding)/welcome.tsx` | none | LIVE | Figma welcome page. Signed-out routes live in one `(onboarding)` group with Welcome as `initialRouteName`; `/` also renders Welcome. `useSignedOutWelcomeLanding` corrects cold starts that land on Login. "View Best Rate Now" opens public `/view-rates` (no sign-in). Globe spins; flags bob/pulse. |
| View rates | `app/view-rates.tsx` | `GET /public/p2p-rates`, `GET /public/instant-rates` | LIVE | Public. Tabs: **Live P2P Rate** (open marketplace offers) and **InstantEX Rate** (admin-published swap rates). |

## 2. Authentication (public)

| Screen | Route | Backing | Status | Notes |
|---|---|---|---|---|
| Login | `app/(onboarding)/login.tsx` | `POST /auth/login`, `POST /auth/google` | LIVE | Email **or** phone + password. Optional Continue with Google (shown when `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` is set). 401 `INVALID_CREDENTIALS`, 403 `USER_DISABLED`, 400 `PASSWORD_LOGIN_UNAVAILABLE`. Biometrics unlock an existing session only. |
| Register | `app/(onboarding)/register.tsx` | `POST /auth/register`, `POST /auth/google` | LIVE | Email, phone, password (8–128). Optional Continue with Google. 409 email/phone taken. |
| Verify email OTP | `app/(onboarding)/verify-email.tsx` | `POST /auth/otp/verify` (`EMAIL_VERIFICATION`/`EMAIL`), `POST /auth/otp/resend` | LIVE | 6-digit input, resend cooldown (client-side UX only), error codes `OTP_INVALID/EXPIRED/MAX_ATTEMPTS`. |
| Verify phone OTP | `app/(onboarding)/verify-phone.tsx` | `POST /auth/otp/verify` (`PHONE_VERIFICATION`/`SMS`) | PARTIAL | Backend never delivers SMS (placeholder). Screen exists; marked "SMS delivery not available yet" and skippable. |
| Forgot password | `app/(onboarding)/forgot-password.tsx` | `POST /auth/password-reset/request` | LIVE | Always shows the neutral "If the account exists…" message. |
| Reset password | `app/(onboarding)/reset-password.tsx` | `POST /auth/password-reset/confirm`, `POST /auth/otp/resend` (`PASSWORD_RESET`/`EMAIL`) | LIVE | Code + new password + confirm. |

## 3. Main tabs (authenticated)

| Tab | Route | Backing | Status | Notes |
|---|---|---|---|---|
| Home | `app/(tabs)/index.tsx` | `GET /wallets`, `GET /kyc/status`, `GET /transactions/recent?limit=6`, notifications unread count, `GET /promotions/active` | PARTIAL | Figma dashboard: menu (→ profile), greeting, bell; swipeable balance card per wallet (one currency per card, never summed; hide/show toggle; chevron → wallet); quick actions Fund wallet / InstantEX / Buy \| Sell / Withdraw (for the wallet on screen, or wallet creation when there is none); KYC and promotions cards; latest 6 transactions grouped by day with "see all" → Activity. Greeting has no first name: the profile has no personal fields yet (CONTRACT_PENDING P2-01). |
| Wallets | `app/(tabs)/wallets.tsx` | `GET /wallets` | LIVE | Empty state: "No Wallets Available" / "Create a new wallet to get started". Stale notice when a refresh fails. |
| Exchange | `app/(tabs)/exchange/index.tsx` | `GET /wallets`, `POST /exchange/calculate` | LIVE | Needs 2 wallets of different currency, else "You need at least two different currency wallets to perform a swap." |
| P2P | `app/(tabs)/p2p.tsx` | `GET /p2p/requests` | PARTIAL | No server-side filter or paging; client-side filter by side/currency/search and sort. See section 7. |
| Activity | `app/(tabs)/activity.tsx` | `GET /transactions/history` (20/page), `GET /transactions/summary` | LIVE | Type filter (all / funding / withdrawals / exchanges) and period (all time / 7 / 30 / 90 days), both sent to the backend. Summary card for the period (counts by type, completed money in/out per currency, completed exchanges, in progress). Grouped by day, "Load more", empty / no-match / error / stale states. Covers funding, withdrawal, exchange only (backend scope); links to P2P history. No search or status filter (T-1). |
| Transaction detail | `app/transaction/[type]/[id].tsx` | `GET /transactions/{type}/{id}` | LIVE | Status header (success only on `SUCCESS`), amounts (exchange: sent, received, applied rate), failure reason, reference, progress from recorded ledger steps (R-T-4). Re-read while in progress (R-T-5). Links to the funding/withdrawal status screen (instructions, destination) and the wallet. Unknown type in a link → "Transaction not found" without a request. |

## 4. Wallets

| Screen | Route | Backing | Status | Notes |
|---|---|---|---|---|
| Wallet detail | `app/wallet/[id]/index.tsx` | `GET /wallets/{id}`, `GET /wallets/{id}/transactions` (infinite, 20/page), `GET /transactions/recent?limit=50` | LIVE | Available + pending balances with "As of" time and stale notice, ledger entries (CREDIT/DEBIT/HOLD/RELEASE) with "Load more", in-progress fundings/withdrawals for this wallet. Fund/Withdraw disabled for currencies without a rail (R-W-10). |
| Create wallet | `app/wallet/create.tsx` | `GET /currencies`, `POST /wallets` | LIVE | Hides currencies the user already holds; 409 `WALLET_EXISTS` refetches the list. |
| Delete wallet | — | none | PENDING | No endpoint. Not shown. |

## 5. Funding and withdrawal

| Screen | Route | Backing | Status | Notes |
|---|---|---|---|---|
| Fund: amount → review | `app/wallet/[id]/fund.tsx` | `GET /wallets/{id}`, `POST /funding` + `Idempotency-Key` | LIVE | Two steps in one screen. The method follows the wallet currency; no method picker, no fee line (W-2). |
| Fund: instructions / status | `app/wallet/funding/[fundingId].tsx` | `GET /funding/{id}` (poll 5 s while in progress with a provider, 30 s otherwise) | LIVE | NGN: VA `paymentDetails`. CAD: Instant Interac `paymentDetails` (payee/amount/reference, copy) while awaiting send. Credit only on `SUCCESS`. `INITIATED` with no provider = "Funding isn't available for {CUR} yet". |
| Withdraw: amount + destination → review + PIN | `app/wallet/[id]/withdraw.tsx` | `GET /security/pin`, `POST /security/pin/verify`, `POST /withdrawals` + `Idempotency-Key` | PARTIAL | CAD: Interac email/phone or EFT; NGN: bank code + account number. PIN check is a **client-side step** (R-SEC-2, S-1). |
| Withdraw: status | `app/wallet/withdrawal/[withdrawalId].tsx` | `GET /withdrawals/{id}` (poll) | LIVE | Held / complete / failed (amount released) / reversed copy. Destination shown masked. |

## 6. Exchange

| Screen | Route | Backing | Status | Notes |
|---|---|---|---|---|
| Exchange form | `app/(tabs)/exchange.tsx` (optional `from` wallet param) | `GET /wallets`, `POST /exchange/calculate` (400 ms debounce) | LIVE | Source/target wallet sheets, swap, amount on either side; the other side and the rate line come from the backend. Blocks send amounts above available (R-X-9). Fewer than two currencies shows the evidence copy. |
| Exchange review + confirm | `app/exchange/review.tsx` (`side` param) | `POST /exchange/preview` (shared via mutation cache), `POST /security/pin/verify` (client step), `POST /exchange/execute` + `Idempotency-Key` | LIVE | Locked quote with countdown; "Get a new quote" on expiry, 409 `EXCHANGE_QUOTE_EXPIRED`/`NOT_OPEN` or 404. 422 keeps the quote usable. No fee line. |
| Exchange result | `app/exchange/[exchangeId].tsx` | `GET /exchange/transactions/{id}`, `GET /wallets` (currency codes) | LIVE | Status from backend only; failed = "Nothing was exchanged." |
| Currencies and rates | `app/exchange/rates.tsx` | `GET /currencies`, `GET /exchange-rates/latest?base&quote` | PARTIAL | Currency list plus a single-pair lookup showing published buy/sell exactly. No all-pairs board (X-1). |
| Rates board (all pairs) | — | none for customers | PENDING | Admin-only endpoint exists. Single-pair lookup is on the rates screen above. |

## 7. P2P

| Screen | Route | Backing | Status | Notes |
|---|---|---|---|---|
| Marketplace | `app/(tabs)/p2p.tsx` | `GET /p2p/requests` | PARTIAL | Side segmented control, currency and sort sheets, search on codes/notes, all on the device (R-P-8); no paging. Own requests marked "Yours". Header links to history and create. |
| Request detail | `app/p2p/request/[id]/index.tsx` | `GET /p2p/requests/{id}`, `GET /p2p/me/orders` (when accepted) | LIVE | Non-owner + OPEN: Accept (confirm dialog). Owner + OPEN: Edit, Cancel (confirm). Accepted/completed and mine: "View order". Past expiry shows Expired (R-P-7). Non-owner + OPEN also gets "Make an offer" (or "View your offer"); the owner sees the offers on the request. |
| Create request | `app/p2p/create.tsx` | `GET /currencies`, `POST /p2p/requests` | LIVE | side, base, quote (picking the same currency swaps), amount, rate, expiry preset, notes (≤500). No payment-method field exists. Opens the new request on success. |
| Edit my request | `app/p2p/request/[id]/edit.tsx` | `PUT /p2p/requests/{id}` | LIVE | Only while `OPEN`; sends changed fields only; expiry can be kept or moved. |
| Cancel my request | action on detail | `DELETE /p2p/requests/{id}` | LIVE | OPEN → CANCELLED. |
| Accept request | action on detail | `POST /p2p/requests/{id}/accept` | LIVE | Replaces detail with the new order. 409 `P2P_NOT_OPEN` refreshes the status; `P2P_SELF_ACCEPT` explained. |
| P2P history | `app/p2p/history.tsx` (`tab=requests\|offers\|orders`) | `GET /p2p/me/requests`, `GET /negotiations/me`, `GET /p2p/me/orders` | LIVE | My requests in every status; offers (see §8); orders with my role ("You accepted" / "Your request was accepted"). |
| Order detail | `app/p2p/order/[id].tsx` | `GET /p2p/orders/{id}`, `GET /p2p/requests/{requestId}`, `POST /chat/rooms` | PARTIAL | "Message" opens (or creates) the order's chat room. | Order stays `ACCEPTED`; no customer lifecycle (pay/release/complete/dispute) and **no escrow or settlement**; the screen says Palpeer doesn't move money for it. Non-participants get 404. |
| Order preview (fees) | — | none | PENDING | |

## 8. Negotiation and chat

| Screen | Route | Backing | Status | Notes |
|---|---|---|---|---|
| Make offer ("What is your best offer?") | `app/negotiation/offer.tsx?requestId=` | `GET /p2p/requests/{id}`, `POST /negotiations/offers` | LIVE | Starts from the posted amount/rate. Reached from request detail ("Make an offer": non-owner, OPEN). 409 `NEGOTIATION_EXISTS` links to the open offer (`GET /negotiations/me?p2pRequestId=`). |
| Negotiation detail | `app/negotiation/[id].tsx` | `GET /negotiations/{id}`, `GET /p2p/requests/{id}`, `POST /negotiations/{id}/counter`, `/accept`, `/reject`, `/cancel`, STOMP `/user/queue/negotiations`, `GET /p2p/me/orders` (only for negotiations accepted before V26) | LIVE | Offer history (OFFER/COUNTER with PENDING/SUPERSEDED/ACCEPTED/REJECTED), whose turn it is. On my turn: Accept, Counter, Decline (Accept and Decline confirmed; R-N-2). While waiting: Cancel negotiation (confirmed). Accept hidden when the request is no longer OPEN (R-N-4). Ended negotiations say who ended them and why (R-N-3). After accept, "View order" via `p2pOrderId`. Live updates; 15 s re-read only while live updates are down (R-N-5). |
| My offers | `app/p2p/history.tsx?tab=offers` | `GET /negotiations/me`, STOMP `/user/queue/negotiations` | LIVE | Negotiations I opened or received, newest first, with pair and state ("Your turn", "Waiting", "You declined", "They cancelled", "Request closed"…). Owner's request detail lists its offers (`GET /negotiations/me?p2pRequestId=`). Both update live. |
| Chat rooms | `app/chat/index.tsx` | `GET /chat/rooms`, `GET /p2p/me/orders` | LIVE | Entry: Messages icon on the P2P tab, "Message" on order detail (`POST /chat/rooms`). Title = order pair. No last message/unread info (C-2). |
| Chat room | `app/chat/[roomId].tsx` | `GET /chat/rooms/{id}`, `GET /chat/rooms/{id}/messages` (pages of 50), `POST /chat/rooms/{id}/messages`, `POST /chat/rooms/{id}/read`, STOMP `/topic/rooms.{id}` and `/topic/rooms.{id}.reads` | LIVE | Inverted list, older pages on scroll. Optimistic send with `clientMessageId`; failed messages stay with "Tap to retry" (same id). Incoming via the shared realtime connection; history and read markers re-read after every (re)connect and on return to the foreground (R-C-3). Reports what I've read and shows "Seen" under my newest message (R-C-5). Connection banner (connecting / reconnecting / offline / unavailable). No presence/typing/unread counts (C-2). |

## 9. Cards

| Screen | Route | Backing | Status | Notes |
|---|---|---|---|---|
| Cards list | `app/cards/index.tsx` (from Profile → Cards) | `GET /cards` | LIVE | Card faces with masked `•••• lastFour`, brand, expiry, currency, "Test card" label, frozen state; status badge; pull to refresh; empty state → Issue a card. |
| Issue card | `app/cards/create.tsx` | `GET /currencies`, `GET /wallets`, `POST /cards` | PARTIAL | Currency radio list, optional link to the same-currency wallet, optional name (≤ 120), confirmation dialog. No preview/fee/type (CD-2). |
| Card detail | `app/cards/[id].tsx` | `GET /cards/{id}`, `POST /cards/{id}/block`, `/unblock`, `GET /cards/{id}/transactions` (20/page) | LIVE | Card face, Freeze (confirm) / Unfreeze (confirm + PIN if set), masked details, linked wallet link, test-card notice, "funding/withdrawal not available" notice, transactions with Load more and empty state. |
| Fund card / withdraw from card | — | none | PENDING | Cards aren't linked to the ledger (CD-3). |
| Reveal PAN/CVV | — | none | PENDING (by design) | Never shown. |

## 10. KYC

| Screen | Route | Backing | Status | Notes |
|---|---|---|---|---|
| KYC hub (intro, steps, status, result) | `app/kyc/index.tsx` | `GET /kyc/status`, `GET /kyc/progress` | LIVE (Phase 4) | Steps document → selfie → submit; polls every 30 s while SUBMITTED/UNDER_REVIEW; APPROVED and REJECTED (+ reason) shown here — there is no separate result route. |
| Document type | `app/kyc/document-type.tsx` | none (client list) | PARTIAL | Backend accepts free text; list uses the values the backend maps for ComplyCube (PASSPORT, DRIVING_LICENSE, NATIONAL_ID, RESIDENCE_PERMIT). Final list needs confirmation (pending K-1). |
| Document capture | `app/kyc/document.tsx?type=` | `expo-camera`, `expo-image-picker`, `POST /kyc/documents` (multipart, XHR with progress) | LIVE (Phase 4) | Front side only (backend has no side field). Camera or library; photo re-encoded to JPEG ≤ 2000 px; review → upload with progress; failure keeps the photo for "Try again". Screenshots blocked. |
| Selfie capture | `app/kyc/selfie.tsx` | `expo-camera` (front), `POST /kyc/selfie` | LIVE (Phase 4) | Camera only (no library). Plain selfie. **Liveness: `LIVENESS_CONTRACT_PENDING`.** |
| Personal details + submit | `app/kyc/submit.tsx` | `POST /kyc/verification/start` | PARTIAL | firstName, lastName, optional DOB and issuing country. 503 `KYC_PROVIDER_DISABLED` (dev default) → "Identity verification isn't available yet"; status stays IN_PROGRESS. |

## 11. Profile, security, settings

| Screen | Route | Backing | Status | Notes |
|---|---|---|---|---|
| Profile | `app/profile/index.tsx` | `GET /profiles/me` (+ `POST /profiles` once on 404), `GET /kyc/status`, stored login email | PARTIAL (Phase 4, hub reworked Phase 13) | Backend has no user-info endpoint and no profile fields. Shows email captured at login, then groups: Account (Identity verification with status, Security, Cards), Rewards (Invite friends, Promotions), Preferences (Notifications, Privacy, Settings), Help (Help & support), and Sign out (confirmed). |
| Settings | `app/settings/index.tsx` | none | LIVE (Phase 13) | Appearance (system/light/dark), links to Notifications, Security, Privacy, Help, and the app version. |
| Privacy | `app/settings/privacy.tsx` | build config only | PARTIAL (Phase 13) | Privacy policy / terms (system browser, only if configured), what each permission is used for + "Manage permissions in phone settings", what's kept on the phone, screen protection, account deletion request by email (U-4). |
| Personal information / edit | — | none | PENDING | |
| Security hub | `app/security/index.tsx` (from Profile → Security) | `GET /security/pin`, `GET /security/questions`, `GET /security/devices` | LIVE (Phase 5) | PIN status + lock banner (`lockedUntil`), links to PIN / questions / devices, biometric unlock switch. |
| Set PIN | `app/security/pin/set.tsx` | `POST /security/pin` | LIVE (Phase 5) | Enter + confirm on the in-app keypad (4–8 digits, provisional P3-01). 409 `PIN_ALREADY_SET`. |
| Change PIN | `app/security/pin/change.tsx` | `GET /security/pin`, `PUT /security/pin` | LIVE (Phase 5) | Current → new → confirm. 401 `PIN_INVALID` back to current; 423 / `lockedUntil` shows the lock state. |
| Forgot PIN | `app/security/pin/forgot.tsx` | `GET /security/pin`, `GET /security/questions`, `POST /security/pin/reset` | LIVE (Phase 5) | Answers to every configured question + new PIN. No questions → "contact support". Wrong answers count towards the lock. No email reset (pending S-2). |
| Security questions | `app/security/questions.tsx` | `GET /security/questions`, `PUT /security/questions` | PARTIAL (Phase 5) | App-supplied list of 8 questions, 2 required (pending S-3). Replacing requires PIN confirmation when a PIN is set (client rule R-SEC-8). |
| PIN prompt (shared) | `features/security/PinPromptProvider.tsx` (sheet) | `POST /security/pin/verify` | LIVE (Phase 5) | `usePinPrompt().requestPin()` for any screen that needs a PIN confirmation. |
| Biometric unlock | switch on the hub; lock overlay `features/security/lock/LockScreen.tsx` | `expo-local-authentication`, `POST/GET/DELETE /security/devices` | PARTIAL (Phase 5) | App lock over a stored session, not a backend login (pending S-4). |
| Registered devices | `app/security/devices.tsx` | `GET /security/devices`, `POST /security/devices/{id}/enable\|disable`, `DELETE /security/devices/{id}` | LIVE (Phase 5) | Marks "This device". Disabling/removing this device turns biometric unlock off. `lastUsedAt` hidden (never set by backend). |
| Active sessions | `app/security/sessions.tsx` (Security → Active sessions) | `GET /auth/sessions` (+ `X-Refresh-Token`), `POST /auth/sessions/{id}/revoke`, `POST /auth/sessions/revoke-all` | LIVE (Phase 13) | "This phone" marked; sign-in and expiry times; end one session (confirmed) or "Sign out of all devices". Ending this phone's session signs out with a login notice (R-A-10). |
| Change password | `app/security/password.tsx` (Security → Password) | `POST /auth/password/change` | LIVE (Phase 13) | Current + new + confirm (8–128). Wrong current password shown on its field. Signs out everywhere after success with a login notice. Screenshots blocked. |
| Notification settings | `app/notifications/settings.tsx` (Profile → Notifications, or the gear in the notification center) | `POST/GET/DELETE /notifications/device-tokens` | LIVE | Switch for this phone: permission asked only when turned on; blocked permission → "Open phone settings"; no push credentials → clear message (NT-5). Lists other devices with Remove (confirmed). |
| Appearance | part of `app/settings/index.tsx` | none | LIVE | Light / dark / system. |
| Logout | Profile → Sign out (confirmed); also Active sessions | `POST /auth/logout` | LIVE | Removes this phone's biometric-device and push records (best effort), then clears Secure Store and caches. |

## 12. Notifications, referrals, promotions, support

| Screen | Route | Backing | Status | Notes |
|---|---|---|---|---|
| Notification center | `app/notifications/index.tsx` (Home bell with unread badge) | `GET /notifications` (20/page), `POST /notifications/{id}/read`, `GET /notifications/unread-count` | LIVE | Unread dot, Load more, pull to refresh, empty/error/stale states. Tapping marks read and opens Invite friends for `REFERRAL`, otherwise the detail. Mark-all-read not available (NT-2). |
| Notification detail | `app/notifications/[id].tsx` | `GET /notifications/{id}`, `POST /notifications/{id}/read` | LIVE | Target of push taps. Marks read on open; "Open" when the type maps to a screen; 404 → "not found". |
| Referrals (Invite friends) | `app/referrals/index.tsx` (Profile → Invite friends, promotion cards) | `POST /promotions/referrals/my-code`, `GET /promotions/referrals/mine`, `POST /promotions/referrals/apply` | LIVE | My code + share sheet, apply a friend's code (confirmed, backend errors explained), friends who joined. `?code=` from a link pre-fills only. |
| Bonuses | `app/referrals/bonuses.tsx` | `GET /promotions/bonuses/mine` (20/page) | PARTIAL | Exact amounts with status; note that pending bonuses can't be spent. No payout exists (P14-03). |
| Promotions | `app/promotions/index.tsx` (Home card when any are active, Profile link) | `GET /promotions/active` | PARTIAL | Title, type, description, bonus, period; referral ones link to Invite friends. Not personalised (PR-1). |
| Help & support (FAQ + contact) | `app/support/index.tsx` (Profile, Settings, and login → "Need help?"; available signed out) | static FAQ (`features/support/faq.ts`), build config | PARTIAL (Phase 13) | Searchable FAQ in 6 sections, answers expand on tap. Contact: email (pre-filled subject and app version) and phone, only if configured, otherwise "not available yet" (SP-1). Warns never to share passwords, PINs or codes. |
| Support tickets / live chat | — | none | PENDING (SP-2) | |

## 13. Global states (every data screen)

Loading skeleton, empty, error with retry, offline banner ("You're offline. Some features may be unavailable."), stale-data label with last-updated time, processing overlay for money actions, success only after backend confirmation.

## 14. Deep links (initial set)

| Link | Screen | Condition |
|---|---|---|
| `palpeer://transaction/{type}/{id}` | Transaction detail | Auth required; refetches `GET /transactions/{type}/{id}` |
| `palpeer://wallet/{id}` | Wallet detail | Auth required |
| `palpeer://p2p/request/{id}` | Request detail | Auth required |
| `palpeer://p2p/order/{id}` | Order detail | Auth required |
| `palpeer://negotiation/{id}` | Negotiation detail | Auth required |
| `palpeer://chat/{roomId}` | Chat room | Auth required |
| `palpeer://kyc` | KYC status | Auth required |
| `palpeer://cards/{id}` | Card detail | Auth required |
| `palpeer://notifications` / `palpeer://notifications/{id}` | Notification center / detail | Auth required |
| `palpeer://referrals?code=REF…` | Invite friends, code pre-filled (never auto-applied) | Auth required |
| `palpeer://promotions`, `palpeer://activity` | Promotions / Activity | Auth required |

Transactions need `{type}` in the link because the backend lookup is `/transactions/{type}/{id}`. Links are resolved in `app/+native-intent.tsx` through the allowlist in `services/navigation/deepLinks.ts` (R-NT-6): the app always starts at `/` and the destination is queued, then opened once the signed-in tabs are mounted (after sign-in if needed). Unknown links just open the app. Push taps use the same queue.
