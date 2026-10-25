# Push notifications (Expo + FCM)

PALPEER keeps **`expo-notifications`** on the client and delivers pushes with the
**Firebase Admin SDK** on the backend. React Native Firebase is not required.

## 1. Firebase console

1. Create a Firebase project (or reuse an existing one).
2. Add Android app with package `com.palpeer.app` → download `google-services.json`.
3. Add iOS app with bundle id `com.palpeer.app` → download `GoogleService-Info.plist`.
4. Project settings → Service accounts → Generate new private key → save as
   `firebase-service-account.json` (backend only; never ship in the app).

## 2. Mobile (EAS / local credentials)

Place the client files in `palpeer-mobile/` (gitignored):

- `google-services.json`
- `GoogleService-Info.plist`

Or point env vars at them before `eas build` / `npx expo prebuild`:

```bash
GOOGLE_SERVICES_JSON=/secure/google-services.json
GOOGLE_SERVICES_PLIST=/secure/GoogleService-Info.plist
```

`app.config.ts` only wires these paths when the files exist, so local Metro without
credentials still starts. Push registration on a device needs a **dev/preview build**
that includes the Firebase files.

For EAS, upload the Android file as a **file** environment variable (preview + production):

```bash
cd palpeer-mobile
npx eas-cli env:set --name GOOGLE_SERVICES_JSON --type file \
  --value ./google-services.json --visibility secret \
  --environment preview --environment production --non-interactive
```

Also upload an FCM HTTP v1 service-account key under EAS credentials (Android →
Google Service Account) so Expo’s push service can deliver to Android devices.
See Expo “FCM credentials” docs.

## 3. Backend

In `.env`:

```bash
PALPEER_FCM_ENABLED=true
# Prefer one of:
PALPEER_FCM_CREDENTIALS_FILE=/secure/firebase-service-account.json
# or inline JSON (PaaS):
PALPEER_FCM_CREDENTIALS_JSON={"type":"service_account",...}
```

When `PALPEER_FCM_ENABLED=false` (default), or when credentials are missing, the API
logs push attempts only (`LoggingPushNotifier`) so the service still boots.

On Render, set both:

```bash
PALPEER_FCM_ENABLED=true
PALPEER_FCM_CREDENTIALS_JSON={"type":"service_account",...}
```

## 4. Payload contract

Every push `data` map includes (string values):

| Key | Purpose |
|-----|---------|
| `notificationId` | Opens `/notifications/{id}` |
| `referenceType` | Optional deep link hint (`FUNDING`, `REFERRAL`, …) |
| `referenceId` | Optional related entity id |
| `category` | Optional inbox category |

Title/body are sent as the FCM notification payload for system tray display.
