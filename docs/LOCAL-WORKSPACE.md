# Local workspace — 10 October 2026

Recovered from https://github.com/arhanali003/basket at commit `28478ba`.
Workspace: `/Users/arhanali/Documents/ChatGPT/web page blinkit`.

## Start the preview

From the workspace root, run `npm run dev`.

| Component | Local URL | Main files |
| --- | --- | --- |
| Customer storefront | http://localhost:3000 | `apps/storefront/app/page.tsx`, `apps/storefront/app/store.css` |
| Admin panel | http://localhost:3001 | `apps/admin/app/page.tsx`, `apps/admin/app/admin.css` |
| Delivery app | http://localhost:3002 | `apps/delivery/app/page.tsx`, `apps/delivery/app/delivery.css` |
| Backend and API documentation | http://localhost:4000/api/docs | `apps/api/src/`, `apps/api/prisma/` |

Shared UI and styles are in `packages/ui/src/`; shared configuration is in
`packages/config/src/index.ts`. Storefront metadata is in
`apps/storefront/app/layout.tsx`. Offline/browser caching code is in
`apps/storefront/public/sw.js` and `apps/delivery/public/sw.js`.
Vercel configuration is in each app's `vercel.json`; deployment notes are in
`docs/VERCEL.md`.

## Prepared environment

- Node.js 24.21.0; dependencies installed with pnpm 10.32.1 and the frozen lockfile.
- Local `.env` generated from `.env.example`, with mock providers enabled.
- Separate SQLite demo database at `apps/api/prisma/daybasket.db`, seeded with
  16 products and 8 categories. Live orders and production data are not copied.
- Local environment files, databases and dependencies are excluded from Git.
- No remote pushes or deployments were performed during workspace preparation.

For future dependency installs, use the pinned pnpm version:

```sh
npm exec --yes --package=pnpm@10.32.1 -- pnpm install --frozen-lockfile
```

After a fresh dependency install, `npm run setup` generates the Prisma client,
creates the local SQLite schema and seeds the demo. Use it only with a local
development database configuration.

## Baseline verification

- Lint passed.
- Type checks passed for all eight workspace packages.
- All 41 unit tests passed across three suites.
- Storefront, admin, delivery and API production builds passed locally.
- Local API readiness and catalogue requests returned HTTP 200.
- All three local application homepages returned HTTP 200 with stylesheet links.

Browser end-to-end tests and live deployment verification were not run as part
of this setup. Local builds do not verify production credentials or hosting.
