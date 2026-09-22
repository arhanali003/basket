# Deployment preparation

Read STATUS.md before deploying: these are templates for the implemented slice, not a claim of launch readiness. No services have been provisioned.

## Local PostgreSQL/Redis

Docker must be installed separately. The current machine did not have Docker available.

```sh
docker compose up -d
# Set DATABASE_URL in .env to:
# postgresql://daybasket:local-development-only@localhost:5432/daybasket
pnpm exec prisma generate --schema apps/api/prisma/schema.production.prisma
pnpm exec prisma migrate deploy --schema apps/api/prisma/schema.production.prisma
pnpm db:seed
pnpm dev
# Separate terminal, from repository root:
node --import tsx apps/api/src/worker.ts
```

The generated Prisma client is provider-specific. Regenerate against schema.prisma to return to SQLite. Do not apply the PostgreSQL migration to SQLite. `pnpm setup` is for the SQLite local demo. After changing models, update both schemas and generate a reviewed migration with the PostgreSQL schema.

## MVP topology

Create separate staging and production projects/databases/Redis/auth apps/buckets. Place API, database and worker near one another in Singapore. Configure PostGIS on the managed PostgreSQL service using an account allowed to create the extension; remove the migration's extension creation only after provisioning it separately. Set PostgreSQL TLS/connection pool configuration required by your provider.

The root `render.yaml` describes an API and separate maintenance worker. Build with Dockerfile.api. The release command applies reviewed migrations before serving. `/api/v1/health` checks the process; `/api/v1/ready` queries the database. The worker connects to Redis independently; add an external queue liveness monitor before production use.

For each Vercel project, choose its app root (`apps/storefront`, `apps/admin`, `apps/delivery`), enable source files outside the root, install from monorepo root with `pnpm install --frozen-lockfile`, and use the app's `pnpm build`. Set NEXT_PUBLIC_API_URL to `https://api.[DOMAIN]/api/v1`, NEXT_PUBLIC_SOCKET_URL to `https://api.[DOMAIN]`, and NEXT_PUBLIC_SITE_URL to the relevant HTTPS site. These are build-time values. Test staging cross-origin cookies and WebSocket reconnection before release.

Map `www.[DOMAIN]`, `admin.[DOMAIN]`, `delivery.[DOMAIN]` and `api.[DOMAIN]` through provider-managed domain settings and TLS. Redirect HTTP to HTTPS. Configure the exact three frontend origins in CORS_ORIGINS. Keep auth domains on the same registrable domain for SameSite cookies; unrelated preview domains need their own deliberate auth strategy. Never expose a service-account credential through NEXT_PUBLIC variables.

## Configuration checklist

| Variable | Purpose / action |
|---|---|
| DATABASE_URL | Private managed PostgreSQL URL, TLS as required |
| REDIS_URL | Private managed Redis URL; `rediss://` for TLS |
| NODE_ENV | `production` |
| MOCK_PROVIDERS | `false` (production mock login is rejected) |
| DELIVERY_CODE_SECRET | Strong random stable secret, at least 32 bytes; rotating invalidates outstanding codes |
| CORS_ORIGINS | Comma-separated exact storefront/admin/delivery HTTPS origins |
| GOOGLE_APPLICATION_CREDENTIALS | Path to securely mounted Firebase service-account JSON |
| FIREBASE_PROJECT_ID | Corresponding Firebase project |
| LOCATION_RETENTION_DAYS | Default 7; enforce with running maintenance worker |
| NEXT_PUBLIC_API_URL / NEXT_PUBLIC_SOCKET_URL | Browser REST and WebSocket URLs |
| RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET / RAZORPAY_WEBHOOK_SECRET | Set only after completing the unexposed payment flow |
| GOOGLE_MAPS_API_KEY / NEXT_PUBLIC_GOOGLE_MAPS_KEY | Restrict backend key by API/IP and browser key by API/referrer; maps adapter remains future work |
| S3_BUCKET / RESEND_API_KEY | Reserved configuration for future storage/email adapters |

Firebase: enable Google and phone providers, configure authorized domains, provision credentials on the backend, implement the remaining frontend flow, and provision staff roles deliberately in the database. The API verifies ID tokens and revocation before issuing a cookie. Never infer a privileged role from an email address or client field.

Razorpay: create test credentials, finish reservation/webhook/reconciliation work in STATUS.md, verify exact raw-body HMAC signatures and unique event IDs transactionally, test duplicate and out-of-order events, then separately authorize live keys. No card data is stored.

## CI/CD, monitoring and rollback

GitHub Actions installs locked dependencies, creates the disposable SQLite demo, checks lint/types, runs unit tests and production builds, then Playwright customer/admin/API tests. Add a separate PostgreSQL/Redis integration matrix and staging smoke tests before enabling automatic production deploys. No deploy token is included.

Enable structured request-level logging without raw addresses, phone numbers, tokens, payment bodies or GPS payloads; current code emits startup routes and request IDs but does not yet integrate a production log collector. Configure Sentry for all applications after verifying PII redaction. Monitor API 5xx/latency, order transition failures, payment discrepancies, stale GPS, queue health, DB connections and backup age. Privacy-conscious analytics remains unconfigured.

Deploy immutable image revisions. Roll back application traffic to the previous verified image; do not blindly reverse data migrations. Use expand/contract migrations and forward repairs. Pause order intake during a destructive recovery. Retain previous app image and migration artifacts and rehearse the rollback in staging.

## Backups and restores

Enable managed daily backups and point-in-time recovery with a retention period approved by the business; this requires configuration in the chosen cloud provider and is not automatically enabled by this repository. Store encrypted exports in a private bucket with lifecycle expiration and separate recovery permissions. Schedule and monitor backups with the provider scheduler (not an unverified process in the API container).

```sh
pg_dump --format=custom --file=daybasket-backup.dump "$DATABASE_URL"
# Restore to a NEW, isolated empty database, never the live URL:
pg_restore --no-owner --dbname="$RESTORE_DATABASE_URL" daybasket-backup.dump
```

Run row-count, financial-total, inventory and order checks against the restored database. Test these procedures monthly and record the RPO/RTO. Back up object storage separately. Redis is coordination, not the source of financial truth; maintenance jobs can be recreated.

## Indian-region migration

After verifying the production flow, create private PostgreSQL/PostGIS (managed or operated with appropriate extension support), Redis and S3 in AWS Mumbai. Run API and BullMQ worker as separate ECS services behind an HTTPS ALB supporting WebSockets. Use Secrets Manager, least-privilege IAM, private subnets and monitored backups. Replicate/export the database, copy images, stop order writes briefly for final consistency, validate counts, switch API DNS, and keep Vercel frontends pointed to the stable API domain. Test data-residency and operational requirements with the business; this repository does not assert compliance.
