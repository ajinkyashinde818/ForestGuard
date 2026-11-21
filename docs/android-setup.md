# Android setup

Open `mobile/` in Android Studio (JDK 17 recommended) and sync Gradle. The application ID is `org.forestguard.node`. The default API URL in `mobile/app/build.gradle.kts` targets an emulator (`10.0.2.2`). A physical phone needs the host's LAN address and firewall access; change `API_BASE_URL` in the Gradle file before building.

The current Compose app is a safe foundation only. Device pairing, runtime permission UX, microphone capture, foreground monitoring service, Room event queue, WorkManager retries, and real heartbeat transport are not implemented. The monitoring button is deliberately disabled. Do not enable capture until informed consent, Android foreground microphone service requirements, temporary file cleanup, secure credential storage, and OS/OEM restrictions have been implemented and reviewed.
