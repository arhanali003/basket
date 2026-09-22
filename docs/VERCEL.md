# GitHub and Vercel deployment

Source: https://github.com/arhanali003/basket. Read STATUS.md for application limitations.

## Hosted services

- Storefront: https://basket-three-sandy.vercel.app (Vercel project `basket`, root `apps/storefront`).
- Backend: https://basket-api-eight.vercel.app (Vercel project `basket-api`, root `apps/api`, NestJS preset).
- Database: Neon PostgreSQL Free, connected privately to the API production environment through Vercel Marketplace.

The production migration and catalogue seed have run. The database contains 16 products across 8 categories; production seeding skips development accounts. API health, database readiness, catalogue loading, checkout quotes, rejected untrusted origins and unauthenticated access checks passed on 2026-09-22. The admin login page is deployed at https://basket-admin-delta.vercel.app (`basket-admin`, root `apps/admin`); owner authentication setup is incomplete. The delivery app is not deployed.

The API build script generates the PostgreSQL Prisma client and compiles the application. Production builds also apply committed migrations; `SEED_CATALOGUE=true` runs a create-only catalogue seed. Preview builds do not migrate or seed production data. Review migrations before pushing to the production branch.

The API uses `NODE_ENV=production`, `MOCK_PROVIDERS=false`, a private `DELIVERY_CODE_SECRET`, and the exact storefront origin in `apps/api/vercel.json`. Database credentials remain in Vercel, outside Git. Firebase service credentials have not been configured.

The storefront sets `API_ORIGIN=https://basket-api-eight.vercel.app`. Its Next.js configuration proxies `/api/v1/*` to that origin, uses the relative endpoint in the browser, and derives its public site URL from Vercel's canonical production domain. Product-page server requests use the absolute API origin. Redeploy after changing build-time configuration.

Production Firebase browser login and real payments still need implementation/configuration. Socket.IO and distributed coordination remain unverified; the existing polling fallback is available. The BullMQ maintenance worker still needs a separate worker host or an implemented scheduled replacement; a Vercel HTTP function does not run it continuously.

## Frontend configuration

Import the same GitHub repository as three separate Vercel projects:

| Project | Root directory |
| --- | --- |
| daybasket-storefront | apps/storefront |
| daybasket-admin | apps/admin |
| daybasket-delivery | apps/delivery |

Enable access to source files outside each root directory so packages/ and the workspace lockfile are included. Choose Next.js and Node.js 22.x. Each app's vercel.json selects pnpm install --frozen-lockfile and pnpm run build. Keep the default Next.js output directory. Do not import the legacy root server.js as the storefront.

Before building, set NEXT_PUBLIC_API_URL to the hosted API HTTPS URL ending in /api/v1, NEXT_PUBLIC_SOCKET_URL to its HTTPS origin, and NEXT_PUBLIC_SITE_URL to the corresponding frontend HTTPS origin. Missing API configuration currently falls back to localhost and will not work for online visitors. Redeploy after changing these build-time variables.

GitHub stores source. The separate API project and Neon database above serve the deployed storefront. Redis and the maintenance worker remain unprovisioned; Dockerfile.api and render.yaml describe an alternative topology. Production identity UI work in STATUS.md remains necessary.

Configure exact frontend origins on the API. Session cookies currently require a same-site domain arrangement; unrelated provider domains require an explicit authentication design and browser verification. Do not loosen cookie or origin protections just to make a preview work.

Keep .env files, Firebase service-account JSON, private keys, local databases and .vercel out of GitHub. The existing .gitignore excludes these. Review the complete upload file list and scan source before the first push; do not upload this folder as an unfiltered archive. Backend secrets belong in the backend provider's secret settings, never NEXT_PUBLIC variables.

Vercel Hobby is restricted to personal, non-commercial projects. A commercial store needs an appropriate plan; switching providers does not guarantee that the complete platform is free.

References: https://vercel.com/docs/monorepos and https://vercel.com/docs/plans/hobby

## Admin sign-in setup

The admin production build uses Firebase Google sign-in and same-origin API proxying. Configure `API_ORIGIN`, `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, and `NEXT_PUBLIC_FIREBASE_PROJECT_ID` in the admin project before building. Local demo login remains development-only.

The Google provider is enabled. The admin domain authorization and backend environment settings are pending confirmation. The API CORS allowlist already includes the exact admin origin.

Set `ADMIN_EMAILS` privately on the API to a comma-separated list of approved owner Google emails. Set `FIREBASE_PROJECT_ID` and `FIREBASE_WEB_API_KEY` to the matching Firebase project configuration. The web API key identifies the project; it is not a service-account key. The backend verifies token signatures, issuer, audience and expiry through the Admin SDK, then checks current account state and revocation through Firebase's authenticated account lookup. It rejects disabled/deleted accounts and stale or unverified emails without needing a private service-account key on Vercel.

`/auth/owner` additionally requires a verified Google sign-in and exact allowlist match before provisioning the Firebase UID as `super_admin`. The client cannot supply its own role. Owner email removal also blocks existing owner sessions after deployment of the updated environment. Local demo staff login remains disabled in production.

To add an owner, update `ADMIN_EMAILS` in the API's Vercel production environment and redeploy; that person then signs in with their own Google account. To replace an owner, first add and verify the replacement account, then remove the previous email and redeploy. Existing ownership is keyed by Firebase UID; changing an account's Google email requires an updated allowlist and fresh sign-in. Do not edit database roles as a substitute for the allowlist. Verify a real owner can sign in before calling management access ready.
