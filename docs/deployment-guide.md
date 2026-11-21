# Deployment

Use TLS termination, a private PostgreSQL network, managed secrets, a private persistent audio volume/object store, and a restricted CORS origin. Replace development passwords/secrets and disable/remove seeded accounts. Apply reviewed Prisma migrations as a one-shot deployment job; current local Compose uses `db push` for convenience and must not be copied unchanged to production. Add request rate limits, audit logging, backup/restore drills, audio retention/deletion jobs, monitoring, and gateway revocation handling before field operation.

Gemini configuration is server-side only. Do not bake credentials into images; inject through the runtime secret manager. See [AI integration](ai-integration.md).
