# CI and browser reliability fixes — 10 October 2026

## Cause of the failed GitHub check

The workflow used `pnpm setup`, which configures pnpm itself rather than running
this repository's `setup` script. On a clean runner, the Prisma client was never
generated from the custom schema, causing the API's missing-type errors. The
workflow now explicitly runs `pnpm run setup`. Vercel's API build already used
its own correct production Prisma generation and was not failing for this reason.

Frontend type checks run `next typegen` before TypeScript so a fresh checkout
does not depend on route declarations left behind by a previous local build.
Playwright now manages and waits for all four local servers in CI, fails if a
port is already occupied, and rejects accidentally focused tests. The storefront
uses its production build; admin and delivery use development-only demo sign-in.

## Additional issues covered

- Updated stale browser assertions for the current phone/password customer login,
  required address fields, editable banner copy and Homepage offers controls.
- Session lookups and sign-outs no longer consume the credential-attempt quota.
  Credential POST requests retain the existing 30-per-minute limit; other API
  traffic retains its existing limit. Rate-limited responses include Retry-After.
- Basket persistence waits for saved state to finish loading before writing it.
  Unavailable/quota-limited browser storage no longer crashes the shopping UI.
- Asset recovery also limits reloads to once per minute across changing asset
  URLs, preventing rapid deployments or development asset timestamps from
  bypassing the existing per-version reload guard.
- Regression tests cover saved baskets, blocked storage and rate-limit routing.

## Reproduce safely

Local verification passed in a separate checkout with disposable SQLite data:
lint, all eight package type checks, 78 unit tests, all four production builds
and all 30 browser/API tests. This includes checkout, authorization boundaries,
stock contention, category/product edits, photo uploads, search and resource
recovery. GitHub and Vercel independently run their checks on the pushed commit.

Use a disposable checkout with the local SQLite `.env.example` settings, not
production credentials or an existing shop database:

```sh
pnpm install --frozen-lockfile
pnpm run setup
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm exec playwright install --with-deps chromium
CI=1 pnpm test:e2e
```

The browser suite creates local test accounts, products and orders. Ports
3000–3002 and 4000 must be free. No test is directed at the live database.
Real owner Google authorization, real payments and physical-phone OS eviction
are separate verification steps; local tests do not certify those services.
