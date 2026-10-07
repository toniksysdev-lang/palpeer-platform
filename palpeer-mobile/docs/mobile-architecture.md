# PALPEER Mobile — Architecture (proposed, pending Gate 0 approval)

Native React Native app built with Expo. No WebView, no wrapped website.

---

## 1. Stack

| Concern | Choice | Why |
|---|---|---|
| Runtime | Expo SDK 57 (latest; APK was 56), React Native New Architecture, Hermes | Matches APK lineage; latest stable SDK. |
| Language | TypeScript, `strict: true` | Prompt §2. |
| Navigation | Expo Router (file-based) with typed routes | Prompt §2 allows it; deep links come free; matches the Implementation.md layout. |
| Server state | Redux Toolkit + RTK Query | APK used RTK Query; prompt §9. Endpoint names mirror APK hooks where a verified endpoint exists. |
| App state | Redux Toolkit slices: `session`, `preferences`, `realtime`, `network` | Small, predictable. |
| Styling | Theme tokens in TS (`src/theme`) + NativeWind v4 for layout utilities | Implementation.md asked for NativeWind; tokens remain the single source for colors so dark mode works. **Decision needed at gate** (see §11). |
| Animation | `react-native-reanimated` (press scale, sheets, success states), respects reduced motion | Implementation.md §8. |
| Icons | `lucide-react-native` + `react-native-svg` | Implementation.md. |
| Gradients | `expo-linear-gradient` | |
| Forms | `react-hook-form` + `zod` | Typed validation mirroring backend constraints. |
| Money | `decimal.js-light` for parsing/formatting only; lossless JSON parse | See §6. |
| Lists | `FlatList` first; `@shopify/flash-list` for chat and long activity lists if measured slow | Prompt §55. |
| Secure storage | `expo-secure-store` | Tokens, biometric flag. |
| Biometrics | `expo-local-authentication` | |
| Camera / picker | `expo-camera`, `expo-image-picker`, `expo-image-manipulator` (resize/compress to stay < 10 MB) | |
| Notifications | `expo-notifications`, `expo-device` | |
| Realtime | `@stomp/stompjs` over native WebSocket to `/ws/websocket` | Backend uses SockJS; its raw WebSocket transport avoids the `sockjs-client` dependency. |
| Network status | `@react-native-community/netinfo` | Offline banner. |
| Testing | Jest (`jest-expo`) + React Native Testing Library + MSW for API; Maestro for E2E | Maestro runs on Android emulator/device without native test code. |
| Lint/format | ESLint (expo config) + Prettier | |
| Builds | EAS Build (development, preview, production profiles) | No Android SDK on this machine; EAS cloud builds. |

## 2. Folder layout

Expo SDK 57 reads routes from `src/app/`, so that folder holds routes only. Providers live in `src/providers/` and environment config in `src/config/`.

```text
palpeer-mobile/
  src/
    app/                       # routes only: thin screens that compose feature components
      _layout.tsx              # providers, splash control, Stack.Protected guards
      (onboarding)/welcome.tsx
      (onboarding)/            # welcome (initial), login, register, verify, forgot/reset password
      (tabs)/                  # index (home, "/"), wallets, exchange, p2p, activity
      wallet/[id].tsx
      exchange/…  p2p/…  negotiation/[id].tsx  chat/…  cards/…  kyc/…
      security/…  settings/…  notifications/…  referrals/…  promotions/…  support/…
      modals/                  # fund, withdraw, create-wallet, p2p-create, negotiation-offer, card-create
    providers/  AppProviders, ThemeProvider, NetworkProvider, ErrorBoundary (Realtime, Toast later)
    config/     env.ts
    components/ ui/ forms/ feedback/ navigation/ cards/ lists/ modals/ sheets/ inputs/
    features/   auth/ onboarding/ profile/ kyc/ security/ biometrics/ wallets/ exchange/
                p2p/ negotiation/ chat/ transactions/ cards/ notifications/ promotions/
                referrals/ support/
    services/   api/ auth/ websocket/ notifications/ biometrics/ storage/
    store/      slices/ selectors/ index.ts
    hooks/  types/  utils/  constants/  theme/  mocks/  tests/
  docs/
  e2e/                         # Maestro flows
  app.config.ts  eas.json  .env.example
```

Route files stay thin. Screens live in `src/features/<feature>/screens/` and are re-exported from `src/app/`.

## 3. Navigation

- Root stack: the native splash stays up while preferences load and the session restores (capped at 8 s), then `Stack.Protected` guards pick `(onboarding)` (Welcome first) or `(tabs)`. Home is `(tabs)/index` at `/` when signed in; `/` also renders Welcome when signed out so Login cannot become the cold-start screen.
- `(tabs)`: Home, Wallets, Exchange, P2P, Activity.
- Secondary screens (Cards, Notifications, Referrals, Profile, Security, Support) are stack screens reached from Home header/Profile.
- Money flows (fund, withdraw, exchange confirm, card issue) are modal stacks so they can be dismissed as a unit.
- **Route protection:** `src/app/_layout.tsx` wraps each group in `Stack.Protected` driven by `session.status`. Keeping the intended path for after login (deep links, notifications) is added in Phase 3.

## 4. API layer (`src/services/api`)

```text
client.ts        fetch wrapper: base URL, timeout (15 s), JSON parse with lossless numbers,
                 X-Request-Id header, envelope unwrap, error normalisation
baseApi.ts       RTK Query createApi with baseQueryWithReauth
authApi.ts userApi.ts kycApi.ts securityApi.ts walletApi.ts fundingApi.ts withdrawalApi.ts
currencyApi.ts exchangeApi.ts p2pApi.ts negotiationApi.ts chatApi.ts transactionApi.ts
cardApi.ts notificationApi.ts promotionApi.ts
```

- **Envelope:** unwrap `ApiResponse.data`; on `success: false` or non-2xx, throw `AppError { kind, status, code, message, fieldErrors, requestId }`.
- **Error kinds:** `offline`, `timeout`, `validation` (400/422 with field errors), `unauthorized` (401, or empty-body 403 on an authenticated call), `forbidden`, `notFound`, `conflict` (409), `rateLimited` (429), `server` (5xx), `unknown`. Backend `code` values (e.g. `INSUFFICIENT_AVAILABLE_BALANCE`) map to friendly copy in `src/constants/errorMessages.ts`.
- **Reauth:** `baseQueryWithReauth` uses a mutex so only one `POST /auth/refresh` runs; queued requests retry once with the new token. Refresh failure → `session/expired` → clear Secure Store, reset API state, redirect to login. No retry of a failed refresh.
- **Retry:** only idempotent GETs retry (max 2, backoff) on network/5xx. POSTs never auto-retry, except money POSTs re-sent by the user reuse the same `Idempotency-Key`.
- **Tags:** RTK Query tags (`Wallet`, `Transaction`, `KycStatus`, `P2PRequest`, `Negotiation`, `ChatRoom`, `Card`, `Notification`, `Referral`) invalidate after mutations so balances refresh from the backend rather than being patched locally.
- **Types:** `src/types/api/*.ts` mirror the verified DTOs in `mobile-api-map.md` exactly. Anything without a contract is a typed placeholder tagged `// CONTRACT_PENDING <ID>` and not called.

## 5. Auth and session

- Secure Store keys: `palpeer.refreshToken`, `palpeer.userId`, `palpeer.email`, `palpeer.biometricEnabled`. The access token is kept **in memory only** (15-minute life; refreshed on cold start).
- Cold start: splash reads the refresh token → `POST /auth/refresh` → new pair saved → `(tabs)`. Failure or 8-second timeout → login (with a message only if a session existed).
- App foreground after > 5 min in background: silent refresh; if biometric lock is enabled, require biometric before showing content.
- Logout: `POST /auth/logout` with the refresh token (best effort), then clear Secure Store, Redux, RTK Query cache, STOMP connection, and unregister the push token record.

## 6. Money handling

- JSON money values arrive as numbers with up to 12 decimals (sometimes scientific notation). `JSON.parse` would lose precision, so `client.ts` parses with a reviver that reads number literals as strings (via a lossless parser such as `lossless-json`) for known money fields, and types them as a branded `Money = string`.
- Display uses `formatMoney(amount, currency)` with `decimal.js-light` for rounding **for display only**, using the currency's `precision`.
- Requests send amounts as JSON numbers built from the user's typed string without float conversion (serialised verbatim).
- No arithmetic on amounts anywhere except input validation (> 0, ≤ available for UX hints). Totals, rates and converted amounts come from the backend.

## 7. Realtime (`src/services/websocket`)

As built in Phase 9:

```text
url.ts            brokerUrl(EXPO_PUBLIC_WS_URL): http(s)→ws(s), appends '/websocket'
connection.ts     RealtimeConnection: the single @stomp/stompjs Client, status, ref-counted
                  destination subscriptions (listen / subscribe for chat rooms), auth in
                  beforeConnect, backoff, background grace
events.ts         parses raw frames: ChatMessageResponse, ChatReadReceipt, NegotiationResponse
                  (lossless: amount/rate stay exact strings)
realtime.ts       app singleton, RealtimeContext, useRealtimeStatus(), useRoomRealtime(roomId)
                  (messages + read receipts), useRealtimeDestination(destination)
features/negotiation/useNegotiationRealtime.ts   /user/queue/negotiations → RTK Query cache
providers/RealtimeProvider.tsx   feeds session, NetInfo and AppState into the connection
store/slices/chatOutboxSlice.ts  unsent/failed messages per room (memory only)
```

- One connection per app session. `RealtimeProvider` tells it whether the user is signed in, online and in the foreground; screens call `useRoomRealtime(roomId, { onMessage, onReceipt, onConnected })` or `useNegotiationRealtime()` and never open sockets.
- Connects only when signed in, online, a broker URL is configured and at least one destination is listened to. Offline or sign-out stops it at once; after 30 s in the background it pauses, and returning to the foreground reconnects (or backfills if still connected).
- `beforeConnect` puts a current access token in the CONNECT headers (refreshing if needed); a STOMP ERROR frame triggers a token refresh before the next attempt. Reconnect backoff is exponential, 1 s to 30 s; each reconnect re-subscribes every destination and runs `onConnected`, which re-reads chat history and the room's read markers, or invalidates the `Negotiation` tags.
- React Native needs `forceBinaryWSFrames` and `appendMissingNULLonIncoming`; both were verified against the live server.
- Sending uses REST `POST /chat/rooms/{id}/messages` (gives a confirmed response); STOMP is used to receive. Messages dedupe by `id` and `clientMessageId`.
- No heartbeats from the server; a dead socket is noticed on close, network change or foreground, and history is re-read then.
- Negotiation pushes replace the cached `getNegotiation` entry and invalidate the negotiation lists (plus request and order tags on accept or request close). The detail screen polls every 15 s only while the connection isn't `connected` (R-N-5).
- Read receipts: the chat room reports the newest unread incoming message once (retrying a failed report after 5 s, on reconnect, or when back online); receipts and mark-read responses merge into the cached room so markers only move forward (R-C-5).

## 8. Native capabilities and permissions

| Capability | Module | Permission (Android / iOS) | When requested |
|---|---|---|---|
| Camera (KYC document, selfie) | expo-camera | `CAMERA` / `NSCameraUsageDescription` | On entering capture screen |
| Photo library (document upload) | expo-image-picker | Android photo picker (no permission) / `NSPhotoLibraryUsageDescription` | On "Choose from library" |
| Biometrics | expo-local-authentication | `USE_BIOMETRIC` / `NSFaceIDUsageDescription` | On enabling biometric login |
| Push notifications | expo-notifications | `POST_NOTIFICATIONS` (Android 13+) / notification prompt | In context, never at launch |
| Secure storage | expo-secure-store | none | — |
| Microphone | — | **Not requested** | The APK had it, but no verified feature needs audio (chat is text-only). |
| Media library write | — | **Not requested** | No feature saves to the gallery. |

Deep link scheme `palpeer`. Android package and iOS bundle id `com.palpeer.app` (CFG-2, decided). Firebase only when push is integrated (NT-1).

## 9. Environments

```env
EXPO_PUBLIC_API_BASE_URL=     # e.g. http://192.168.x.x:8085/api/v1 in development
EXPO_PUBLIC_WS_URL=           # e.g. ws://192.168.x.x:8085/ws
EXPO_PUBLIC_ENV=development   # development | staging | production
EXPO_PUBLIC_SUPPORT_EMAIL=    # support/legal details (SP-1); empty = "not available yet"
EXPO_PUBLIC_SUPPORT_PHONE=
EXPO_PUBLIC_PRIVACY_POLICY_URL=
EXPO_PUBLIC_TERMS_URL=
```

- `.env.development`, `.env.staging`, `.env.production` (not committed; `.env.example` is). EAS profiles set `EXPO_PUBLIC_ENV`.
- `app.config.ts` fails a staging or production build if the API URL is missing.
- Historical `afribdc-backend-0rhk.onrender.com` URLs are not used anywhere.

## 10. No mock mode

The app always talks to a real backend. The unused in-memory mock adapter and `EXPO_PUBLIC_ENABLE_MOCKS` were removed in Phase 14, so no mock code or data can ship in a build. Automated tests use their own fetch and native-module doubles under `src/tests`.

## 11. Design system

- Tokens in `src/theme`: `colors` (light + dark palettes; emerald/green/teal primary scale, deep neutrals), `typography` (Inter or Manrope via `expo-font`, sizes 12–32), `spacing` (4-pt), `radius`, `shadows`, `motion`.
- `constants/Colors.ts` and `constants/Typography.ts` (Implementation.md names) re-export the tokens so both conventions resolve to one source.
- Built in Phase 2 (`src/components/ui`, `src/components/feedback`, `src/components/layout`, `src/providers/ToastProvider`): AppText, Icon, Button, IconButton, Input, PasswordInput, AmountInput (string-only, precision-limited), Card, Badge, StatusBadge, Skeleton/SkeletonRow, AppModal, ConfirmDialog, BottomSheet (drag to dismiss), SegmentedControl, Toast, EmptyState, ErrorState, Screen (safe area, scroll, keyboard avoidance), OfflineBanner. Phase 13–14 added NavRow/RowSection. The development-only `/design-system` gallery was removed in Phase 14 (no debug screens in the app).
- `Screen` adds the bottom safe-area inset on stack screens (edge-to-edge Android, iPhone home indicator); tab screens skip it because the tab bar already reserves it (`TabScreenLayout` context set by the tabs layout). Content is capped at 640 pt wide and centred on tablets and foldables.
- Text scaling: all text goes through `AppText`/`Input` (font scale capped at 1.6×) and theme typography, with no raw font sizes on screens. Fixed-size chrome such as the unread badge uses `minHeight` and a lower cap (1.3×) so it grows instead of clipping.
- The root `ErrorBoundary` cannot rely on the theme provider, so it reads the system colour scheme directly and makes no claims about account state.
- Built with the feature that first needs them: PinInput and OtpInput (Phase 3), CurrencySelector, CurrencyBadge, WalletCard, TransactionRow (Phases 5–6), Avatar, SearchBar, FilterChips, Header.
- Status colors map from backend enums only (success = `SUCCESS`/`APPROVED`/`ACTIVE`; warning = `PENDING`/`PROCESSING`/`INITIATED`/`UNDER_REVIEW`; danger = `FAILED`/`REJECTED`/`BLOCKED`; neutral = `REVERSED`/`CANCELLED`/`EXPIRED`).

**Styling (Phase 1 outcome):** NativeWind 4.2.7 with Tailwind 3.4 is installed and bundles cleanly on SDK 57 (Babel preset + `withNativeWind` Metro wrapper, `global.css` imported in the root layout). Colours come from the TS tokens through `useTheme()`; NativeWind's colour scheme follows the appearance preference. Switching to StyleSheet-only means removing the Babel/Metro wrappers; no screen depends on class names yet.

## 12. Security

- Tokens only in Secure Store (refresh, `WHEN_UNLOCKED_THIS_DEVICE_ONLY`) and memory (access). AsyncStorage holds only the appearance preference and the onboarding flag. Sign-out and expiry clear Secure Store session keys, the RTK Query cache, the chat outbox and any queued link destination.
- Secrets never enter Redux: login, registration, OTP verification, password reset/change (`accountCommands`) and PIN/security-answer calls (`securityCommands`) bypass RTK Query, which keeps mutation arguments and results in the store. Screens track only a pending flag (`useSecretCommand`).
- Transport: staging and production accept only `https` API and `https`/`wss` WebSocket URLs. `app.config.ts` fails the build otherwise, and `buildConfig` treats a non-TLS URL as not configured. Development allows http for a local backend. Android release builds also block cleartext by default.
- Android `allowBackup` is off, so app data isn't copied to cloud or device backups.
- A logger wrapper redacts sensitive keys (password, OTP `code`, PIN variants, tokens, authorization, secrets, CVV/CVC, PAN, card number, security answers) plus Bearer tokens and JWTs inside strings. Debug and info are silent in production. Logs carry the API path (UUIDs only), status, error code and request id, never bodies or query strings.
- Screen capture is blocked (`useSensitiveScreen`, which also hides the Android recents thumbnail) on login, registration, OTP, password reset/change, PIN set/change/forgot, security questions, KYC capture and while the PIN confirmation sheet is open. Each screen uses its own capture key so closing one protected screen can't re-enable capture over another. While signed in, the iOS app-switcher snapshot is blurred. Android has no equivalent short of blocking screenshots app-wide (a product decision, CFG-7).
- Card data: the contract has no PAN or CVV; only `lastFour` is shown.
- Deep links: every incoming URL lands on `/` (`+native-intent`), and only allow-listed paths with UUID ids (plus a validated referral code) are queued. Links over 512 characters are rejected before decoding. Notification payloads are never trusted as data; the target screen refetches.
- The app never calls funding/withdrawal `process`/`fail`/`reverse` or webhook endpoints.
- Dependency audit (Phase 15): `npm audit` reports 14 moderate, 0 high and 0 critical findings, all inside Expo packages. `uuid` (bounds check with a caller-supplied buffer) is used only by build-time tooling (`xcode`). `decode-uri-component` (DoS on malformed percent-encoding) sits under expo-router's `query-string`; untrusted links never reach it because `redirectSystemPath` returns `/`. The patched 0.5.0 is ESM-only and can't be forced under `query-string@7`. Re-check on each Expo SDK update. npm's suggested "fix" (downgrading to Expo 46) was not applied.

## 13. Testing

| Level | Tooling | Coverage |
|---|---|---|
| Unit | Jest | money formatting, lossless parse, validators (mirror backend constraints), error normalisation, status mapping, reauth mutex |
| Component | RNTL | Login, OTP, PinInput, WalletCard, exchange form + quote countdown, transaction row, P2P create, KYC capture states |
| Integration | RNTL + MSW | auth flow incl. refresh and expiry, wallet create, exchange calculate→preview→execute, P2P create/accept, activity paging |
| E2E | Maestro (Android) | the 14 critical flows in prompt §58, against a dev backend |

### Running the E2E suite (Phase 16)

Flows live in `e2e/flows/01-…14-*.yaml` and run in order against one user created by flow 02. `e2e/run.cjs` starts `e2e/helper.cjs`, a local HTTP helper the flows call for the parts the app user can't do: read the development OTP from the backend log, complete a funding as the operator (`POST /funding/{id}/process`), act as the P2P counterparty, touch the emulator fingerprint sensor, and type text with `adb input text`. The helper only works against a development backend. It is test tooling, and the app never calls these endpoints.

Prerequisites:
- A development backend on `:8085` with `OTP_LOG_CODE=true`.
- An emulator AVD with Google APIs, API 35, x86_64 and `hw.keyboard = yes`, so no on-screen keyboard covers buttons.
- Maestro 2.x and a release APK built for the dev env.

The runner enrolls finger 1 on first use (device PIN `1111`), unlocks the keyguard, and turns animations off.

```powershell
# Build and install (release bundle, dev backend reached through the emulator host alias)
$env:EXPO_PUBLIC_ENV='development'; $env:EXPO_PUBLIC_API_BASE_URL='http://10.0.2.2:8085/api/v1'
$env:EXPO_PUBLIC_WS_URL='ws://10.0.2.2:8085/ws/websocket'
cd android; .\gradlew.bat assembleRelease -PreactNativeArchitectures=x86_64 --max-workers=2; cd ..
adb install -r android\app\build\outputs\apk\release\app-release.apk

# Run (admin password comes from the environment, never from source)
$env:E2E_BACKEND_LOG='..\backend\palpeer-app\target\app-stdout.log'; $env:E2E_ADMIN_PASSWORD='<seeded admin password>'
$env:E2E_ADB='<sdk>\platform-tools\adb.exe'; $env:E2E_MAESTRO='<maestro>\bin\maestro.bat'
npm run e2e                 # all 14 flows; JUnit report + artifacts in e2e/results/
npm run e2e -- --from=03    # skip launch/registration: flows 03+ with a pre-registered user
```

Sensitive screens (login, register, OTP, PIN, card) render black in screenshots because of screen-capture protection, so read failures from the view hierarchy that Maestro saves in `e2e/results/artifacts-*`.

## 14. Phase 1 plan (after approval)

1. Scaffold into `palpeer-mobile/` with `npx create-expo-app@latest` (TypeScript + Expo Router template), SDK 57.
2. Add dependencies via `npx expo install` (versions resolved by Expo): expo-router, reanimated, svg, linear-gradient, secure-store, local-authentication, camera, image-picker, image-manipulator, notifications, device, font, screen-capture, netinfo; plus Redux Toolkit, react-redux, lucide-react-native, react-hook-form, zod, @stomp/stompjs, decimal.js-light, lossless-json; NativeWind if approved.
3. `app.config.ts`: name PALPEER, scheme `palpeer`, package/bundle id, permissions from §8 only, New Architecture on.
4. Env handling (`src/config/env.ts`) with validation; `.env.example`.
5. Providers: Redux store, RTK Query `baseApi` with reauth skeleton, Theme (light/dark/system), Toast, ErrorBoundary, NetInfo offline banner.
6. Secure storage service and session slice.
7. Route skeleton: splash, onboarding, auth group, tabs with placeholder screens (clearly labelled), protected-route guard.
8. ESLint, Prettier, Jest (`jest-expo`) with one smoke test per service; `tsconfig` strict.
9. `eas.json` with development/preview/production profiles (no build run yet).
10. Gate 1: `npx expo start` boots, `npx tsc --noEmit`, `npm run lint`, `npm test` all clean.
