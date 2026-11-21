# Database schema

Prisma models: `User`, `Device`, `DeviceHeartbeat`, `Event`, `AudioEvidence`, `AIAnalysis`, `Alert`, `Notification`, `DeviceAssignment`, `EventReview`, and `SystemSetting`. IDs are UUIDs; relations use explicit cascade/restrict behavior; event and device timelines are indexed. `isDemo` marks seeded devices/events. `idempotencyKey` is unique when supplied.

The checked-in schema is at `backend/prisma/schema.prisma`. Development Compose currently applies it with `prisma db push`; create and review versioned SQL migrations with `prisma migrate dev` before production release. Never run schema push as an unreviewed production migration.
