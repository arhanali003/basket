# Daybasket

An original neighbourhood quick-commerce platform: Next.js customer store, store-management studio, delivery-partner PWA, and a separate NestJS API. This is a working **development vertical slice**, not the full production-ready system. Exact implementation and remaining phases: [docs/STATUS.md](docs/STATUS.md).

The original QuickCart `public/`, `server.py`, `server.js`, JSON files and `quickcart.db` are preserved. Daybasket uses its own database under `apps/api/prisma/`. No legacy customer data is imported or changed.

## Run locally

Use Node.js 22 or 24 and pnpm 10.32.1.

```sh
corepack enable
corepack prepare pnpm@10.32.1 --activate
pnpm install --frozen-lockfile
pnpm setup
pnpm dev
```

| App | URL | Local demo sign-in |
|---|---|---|
| Storefront | http://localhost:3000 | Any valid non-staff Indian mobile number; OTP `123456` |
| Admin studio | http://localhost:3001 | Password `daybasket-local-only` |
| Delivery partner | http://localhost:3002 | Password `daybasket-local-only` |
| API / Swagger | http://localhost:4000/api/docs | API sessions are set through sign-in |

Demo customer phone: `9876543210`. Staff phones `9876543211` and `9876543212` are reserved and cannot use customer OTP. Change DEMO_STAFF_PASSWORD in `.env` to replace the local password. Mock sign-in is rejected in production. Use separate browser profiles/private windows for each role: localhost ports share cookies.

`pnpm setup` copies `.env.example` if needed, generates the Prisma client, creates the isolated SQLite database and seeds 16 products/8 categories, one store and three accounts. Seeds are idempotent and do not reset existing stock/orders. PostgreSQL instructions and migrations are in [deployment documentation](docs/DEPLOYMENT.md). No API keys or Docker are necessary for the local slice.

## Try the complete flow

1. Add groceries worth ₹99 or more; open the basket. Try `HELLO10` on a basket of at least ₹299.
2. Sign in with the demo OTP. Add your address; for a test order retain the clearly marked Indiranagar development coordinates. Real device GPS is requested only when you choose it. Addresses beyond the store's 8 km radius are rejected.
3. Choose COD or the clearly labelled test online payment. No real money is charged. Place your order and keep the order page open.
4. In a separate admin browser context, open Orders → Manage. Advance accepted → picking → packed → ready for pickup. Assign Ravi Kumar.
5. In the partner context, confirm pickup. Explicitly consent to GPS sharing. The customer receives actual location updates while the partner page stays open; an honest fallback appears otherwise.
6. Mark arriving, ask for the customer's four-digit order code, and confirm delivery. For COD the partner acknowledges collection. Delivered-order analytics update in admin.

## Checks

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm exec playwright install chromium
# Keep pnpm dev running in a separate terminal:
pnpm test:e2e
```

Playwright tests create clearly named test customers/products/orders in the development database. Use a disposable database for automated tests. CI creates a fresh database. Tests cover real browser checkout/admin forms, integer pricing, tampered client amounts, idempotency, state transitions, cross-customer REST and Socket.IO authorization, GPS updates, delivery proof, concurrent stock consumption, cancellation restock, and mobile width.

Optional local pre-commit checks: `git config core.hooksPath .githooks` (once this directory is a Git repository). The hook runs lint, type checks and domain tests.

## Structure

- `apps/storefront` — customer Next.js App Router app
- `apps/admin` — Next.js store studio
- `apps/delivery` — mobile-first Next.js partner app and PWA scaffolding
- `apps/api` — NestJS, Prisma schemas/seed/migration, worker and provider adapters
- `packages/ui`, `types`, `api-client`, `config` — shared design/contracts/client/tooling
- `tests` — Jest domain tests and Playwright workflows
- [Architecture and database overview](docs/ARCHITECTURE.md)
- [Deployment, environments, backups, rollback](docs/DEPLOYMENT.md)
- [Implemented scope and ordered remaining work](docs/STATUS.md)

## Business placeholders to replace

Development brand: **Daybasket**. Business: groceries. City: **Bengaluru / Indiranagar**. Promise: **30–60 minutes**. Currency: INR. Colours: forest `#285643`, terracotta `#e8743d`, warm cream `#faf9f5`. These are original development defaults, not supplied business facts.

Replace brand/defaults in `packages/config/src/index.ts`, API config and app metadata/copy; store coordinates/radius and products in the seed/database; design tokens in `packages/ui/src/styles.css`. Replace `support@example.invalid`, `[REPLACE_SUPPORT_PHONE]` and `[REPLACE_GSTIN]` on the policies page. Provide approved legal policies, genuine product photos/pack info, tax classes, contacts and domain names. All provider placeholders are in root/app `.env.example` files. Never commit `.env` or credentials.

## Troubleshooting

- **Port 3000 busy:** stop the old QuickCart server before `pnpm dev`. `pnpm legacy` still starts the preserved prototype.
- **Cannot reach API:** check `http://localhost:4000/api/v1/ready`; ensure .env exists and setup completed. Start from the repository root.
- **Wrong account/role:** use separate browser contexts or sign out; cookies are shared across localhost ports.
- **Prisma provider mismatch:** regenerate from `schema.prisma` for SQLite or `schema.production.prisma` for PostgreSQL, then restart API.
- **Empty/missing SQLite file:** setup explicitly creates it before Prisma db push. Do not point DATABASE_URL at `quickcart.db`.
- **Missing package executables:** use the pinned pnpm version; do not mix npm and pnpm installs. Local scripts may be invoked with npm, but dependency installation is pnpm.
- **Browser GPS fails:** browsers require HTTPS or localhost and explicit consent. Manual coordinates remain available. Background tracking is not guaranteed.
- **Images unavailable:** catalogue photos currently depend on remote Unsplash URLs. Supply owned image-hosted assets before launch.
- **Redis absent:** the web demo remains runnable; the separate maintenance worker requires Redis and is necessary to enforce location retention automatically.

Production build success is not production-readiness certification. Real Firebase UI, Razorpay lifecycle/reservations/refunds, Google Maps, distributed abuse protection, media/notification integrations and full business operations remain in the documented next phases.
