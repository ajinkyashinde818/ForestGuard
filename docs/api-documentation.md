# API

Swagger UI: `GET /api/docs`; health: `GET /api/health`.

Human endpoints require `Authorization: Bearer <JWT>` unless noted. `ADMIN` can provision devices; `ADMIN` and `FOREST_OFFICER` can read/review device and event data. Device endpoints use `x-device-id` and `x-device-token`.

| Method | Path | Access | Purpose |
|---|---|---|---|
| POST | `/api/auth/login` | public | Issue short-lived JWT |
| POST | `/api/devices/register` | ADMIN | Provision node; returns secret once |
| POST | `/api/devices/auth` | device | Validate device headers and return device identity |
| POST | `/api/devices/heartbeat` | device | Update telemetry and status |
| GET | `/api/devices` | officer/admin | List active devices |
| GET | `/api/devices/:id` | officer/admin | Device details and recent events |
| PATCH | `/api/devices/:id` | ADMIN | Rename or enable/disable a device |
| PATCH | `/api/devices/:id/status` | ADMIN | Change device availability status |
| POST | `/api/devices/:id/rotate-secret` | ADMIN | Rotate and return a device secret once |
| POST | `/api/events` | device | Submit event; optional idempotency key |
| GET | `/api/events` | officer/admin | Paginated list; `status`, `type`/`eventType`, `severity`, `deviceId`, `from`, `to`, confidence bounds and `isDemo` filters |
| GET | `/api/events/:id` | officer/admin | Event, analysis and review history |
| PATCH | `/api/events/:id/status` | officer/admin | Save status and review note |
| GET | `/api/dashboard/summary` | officer/admin | Counts |
| GET | `/api/dashboard/recent-events` | officer/admin | Latest events |
| GET | `/api/dashboard/event-statistics` | officer/admin | Type and status counts |
| GET | `/api/dashboard/device-statistics` | officer/admin | Availability counts |
| GET | `/api/alerts` | officer/admin | Recent event alerts |
| PATCH | `/api/alerts/:id/acknowledge` | officer/admin | Acknowledge an alert and record the user/time |
| POST | `/api/events/:eventId/audio` | owning device | Upload one short clip as multipart `audio`, with optional duration/recorded time |
| GET | `/api/events/:eventId/audio` | officer/admin | Play authorized event evidence from private storage |

Device heartbeat JSON accepts `battery` (0–100), `latitude`, `longitude`, `accuracy`, `networkStatus`, `monitoringStatus`, `appVersion` and `firmwareVersion`. Stale devices are marked offline after `HEARTBEAT_TIMEOUT_SECONDS` (default 120). Event types are Prisma `EventType` values. Confidence is optional and constrained to 0–1 when supplied; it must not be presented as calibrated probability without validation. Event results are returned as `{ items, total, page, pageSize, pageCount }`.

Audio uploads accept `audio/aac`, `audio/mp4`, `audio/mpeg`, `audio/ogg`, `audio/wav`, `audio/x-wav`, and `audio/webm`, enforce `MAX_AUDIO_BYTES`, and check the file signature against the declared MIME type. Uploaded bytes are stored under the configured private `AUDIO_STORAGE_DIR`; the database stores metadata, checksum, duration and a private storage key. Device credentials must belong to the device associated with the target event. Analysis is started asynchronously only when Gemini is configured. Analysis failure does not remove the event or evidence.
