# GitHub and Vercel deployment

The storefront is deployed at https://basket-arhanquikit.vercel.app from https://github.com/arhanali003/basket. Read STATUS.md for application limitations.

## Backend deployment in progress

Create a separate Vercel project with root apps/api and the NestJS preset. Its vercel.json generates the PostgreSQL Prisma client before compiling. This does not migrate or seed a database during builds, so preview builds cannot change production data.

The planned database is Neon PostgreSQL through Vercel Marketplace. Installing that integration requires the account owner's acceptance of the displayed terms. Provision a free plan if available; do not select a paid plan without authorization. No database has been provisioned yet.

Before deploying the API, connect the database to that API project, configure DATABASE_URL privately, NODE_ENV=production, MOCK_PROVIDERS=false, CORS_ORIGINS=https://basket-arhanquikit.vercel.app and a strong private DELIVERY_CODE_SECRET. Run the reviewed production migration against the new database, then seed catalogue data without development staff accounts. Keep Firebase service credentials out of Git and frontend variables.

After API readiness and catalogue checks pass, configure the storefront API endpoint and verify browser access. Auth still needs the production Firebase browser flow and same-origin cookie routing. Socket.IO requires distributed coordination for multiple instances; the existing polling fallback is available. The BullMQ maintenance worker still needs a separate worker host or a deliberately implemented scheduled replacement; a Vercel HTTP function does not run it continuously.

## Frontend configuration

Import the same GitHub repository as three separate Vercel projects:

| Project | Root directory |
| --- | --- |
| daybasket-storefront | apps/storefront |
| daybasket-admin | apps/admin |
| daybasket-delivery | apps/delivery |

Enable access to source files outside each root directory so packages/ and the workspace lockfile are included. Choose Next.js and Node.js 22.x. Each app's vercel.json selects pnpm install --frozen-lockfile and pnpm run build. Keep the default Next.js output directory. Do not import the legacy root server.js as the storefront.

Before building, set NEXT_PUBLIC_API_URL to the hosted API HTTPS URL ending in /api/v1, NEXT_PUBLIC_SOCKET_URL to its HTTPS origin, and NEXT_PUBLIC_SITE_URL to the corresponding frontend HTTPS origin. Missing API configuration currently falls back to localhost and will not work for online visitors. Redeploy after changing these build-time variables.

GitHub stores source; these frontend deployments do not provision the NestJS API, PostgreSQL database, Redis, or maintenance worker. The existing Dockerfile.api and render.yaml are backend templates, not running infrastructure. Choose and provision backend hosting before verifying catalogue, checkout, login and tracking. Existing production identity UI work in STATUS.md also remains necessary.

Configure exact frontend origins on the API. Session cookies currently require a same-site domain arrangement; unrelated provider domains require an explicit authentication design and browser verification. Do not loosen cookie or origin protections just to make a preview work.

Keep .env files, Firebase service-account JSON, private keys, local databases and .vercel out of GitHub. The existing .gitignore excludes these. Review the complete upload file list and scan source before the first push; do not upload this folder as an unfiltered archive. Backend secrets belong in the backend provider's secret settings, never NEXT_PUBLIC variables.

Vercel Hobby is restricted to personal, non-commercial projects. A commercial store needs an appropriate plan; switching providers does not guarantee that the complete platform is free.

References: https://vercel.com/docs/monorepos and https://vercel.com/docs/plans/hobby
