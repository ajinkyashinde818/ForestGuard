# Architecture

```mermaid
flowchart TD
  Mobile[Android Compose node] -->|x-device-id + x-device-token| Nest[NestJS REST API]
  Officer[Angular dashboard] -->|short lived JWT| Nest
  Officer <-->|JWT authenticated Socket.IO| Live[WebSocket gateway]
  Live --- Nest
  Nest --> Prisma[Prisma ORM]
  Prisma --> Pg[(PostgreSQL)]
  Nest --> Private[Private audio storage volume]
  Nest -. explicit selected clips .-> Gemini[Optional Gemini provider]
```

NestJS is the authority for identity, roles, device credentials, event status, and review history. Device secrets are returned once at provisioning and stored as bcrypt hashes. Human JWTs carry a user ID and role. The gateway checks the JWT at connect time. Audio must be stored outside the web root and served only after event authorization.

The backend includes device provisioning, separate device credentials, heartbeat history and stale-device detection, paginated event filtering/review, private audio transfer, alert acknowledgement, and optional asynchronous Gemini analysis. The Angular shell includes dashboard, event listing and protected event investigation/playback. Android microphone collection/offline synchronization, Leaflet map rendering and user administration remain incomplete; this is not a field-validated detector.
