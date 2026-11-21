# Android monitoring node

The Android app pairs with an administrator-provisioned ForestGuard device and reports GPS/device health while an operator explicitly runs monitoring. This milestone does not request microphone permission, record audio, classify sounds, or upload events.

## Requirements and setup

- Android Studio with Android SDK 35 and JDK 17.
- Open `mobile/` as the Gradle project and sync.
- For the Android emulator, the default API URL is `http://10.0.2.2:3000/api/`. For a physical device or deployed server, use an HTTPS API URL ending in `/api/`.
- The app allows emulator HTTP only in its URL validator. Do not use cleartext HTTP for field devices.

## Pairing

1. Start the backend and sign in as an administrator.
2. Provision a device through the protected `POST /api/devices/register` endpoint. The API returns a device code and one-time device secret. Copy the secret before leaving the response; it is stored only as a bcrypt hash on the server.
3. In the Android app, enter the device code, one-time secret, and backend API URL.
4. The app verifies the credentials through the existing `POST /api/devices/auth` endpoint using `x-device-id` and `x-device-token` headers.
5. After successful authentication, the app encrypts the credentials with AES-GCM using a non-exportable Android Keystore key. The secret is never shown again or written to logs.

The backend currently issues a device code and secret, not a short numeric/expiring provisioning code. The app therefore asks for both returned values and does not invent a provisioning-code exchange endpoint. A rotated/revoked secret is rejected by the backend; provision a replacement and pair again.

## Permissions and monitoring

Before Android shows permission prompts, the app explains why location and notifications are needed. Fine/coarse location is used for real coordinates and accuracy in heartbeats. Notifications support the ongoing foreground-service notification. Denial leaves monitoring stopped and offers Android App Settings for retry.

Starting monitoring requires pairing, location permission, and notification permission on Android 13+. It starts a location foreground service and sends heartbeats with battery, GPS, network, app version, firmware version, and `ACTIVE` status. The service notification reflects GPS/network/battery state. Stopping monitoring stops the service and sends a final `STOPPED` heartbeat when possible.

GPS and heartbeat intervals can be configured from 1 to 60 minutes. The app uses balanced-power, one-shot location fixes and does not continuously poll GPS. Android may defer periodic WorkManager execution under power-management rules.

## Offline behavior

When a heartbeat cannot reach the API, its payload and location sample are persisted in Room. Each heartbeat has a stable UUID request ID which the backend maps to its existing heartbeat primary key, so retrying an accepted request does not create a second history record. Unique network-constrained WorkManager jobs retry queued heartbeats/location samples with exponential backoff and remove each record after a successful API response. The queue survives app process restarts. Pending event storage exists for the next event-capture milestone; this build does not create or upload events.

## Testing and troubleshooting

From `mobile/`, run:

```powershell
.\gradlew.bat :app:testDebugUnitTest
.\gradlew.bat :app:connectedDebugAndroidTest
.\gradlew.bat :app:assembleDebug
```

Pairing errors distinguish rejected/rotated credentials, an incorrect API path, and network/backend failures. For emulator testing, keep the URL at `10.0.2.2`; a physical phone must use a reachable HTTPS hostname. If GPS is unavailable, check Android location settings and grant location permission. If monitoring will not start, allow location and notification permissions in App Settings.

Automated tests cover API URL validation, Room persistence, repository monitoring state/settings, encrypted credential storage, offline heartbeat queuing, and the stopped-monitoring heartbeat worker. Instrumentation tests require an emulator/device; microphone, continuous sound detection, audio upload, and Gemini belong to a later milestone.
