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

For EAS, upload the files as secrets / file credentials and map them into the build
environment (see Expo “googleServicesFile” docs).

## 3. Backend

In `.env`:

```bash
PALPEER_FCM_ENABLED=true
# Prefer one of:
PALPEER_FCM_CREDENTIALS_FILE=/secure/firebase-service-account.json
# or inline JSON (PaaS):
PALPEER_FCM_CREDENTIALS_JSON={"type":"service_account",...}
```

When `PALPEER_FCM_ENABLED=false` (default), the API logs push attempts only
(`LoggingPushNotifier`).

## 4. Payload contract

Every push `data` map includes (string values):

| Key | Purpose |
|-----|---------|
| `notificationId` | Opens `/notifications/{id}` |
| `referenceType` | Optional deep link hint (`FUNDING`, `REFERRAL`, …) |
| `referenceId` | Optional related entity id |
| `category` | Optional inbox category |

Title/body are sent as the FCM notification payload for system tray display.
