# Scope and launch status

**This is a runnable vertical slice with a hosted storefront, API and catalogue database, not the full production-ready platform described in the brief. Do not accept real customers or payments yet.** The request explicitly allows this slice first; the following list distinguishes working code from future work.

## Implemented

- pnpm/Turborepo TypeScript monorepo, three Next.js apps, separate NestJS API, shared UI/contracts/client/config.
- Original responsive storefront, category and text filters, price/discount sorting, product details/shareable URLs, device wishlist, persisted device/account cart, coupon quote and checkout.
- Development OTP with challenge expiry, five-attempt limit and resend delay; database sessions, sign out/current-all-session revocation endpoint; backend Firebase identity verification.
- Location consent, real browser geolocation, manual address/coordinate input, address ownership and radius checks.
- COD and explicit no-money mock payment; atomic inventory consumption, idempotency, immutable order items, cancellation/restock, status history.
- Admin local role login, actual analytics, catalogue create/edit/archive/restore, stock adjustments with reasons, order board/filter, CSV order export, controlled status changes, delivery assignment, audit logs.
- Partner local role login, assigned list, pickup/start, foreground GPS opt-in, navigation, authorized customer call, arrival, customer-code delivery proof and collection acknowledgement.
- Authorized Socket.IO subscriptions, real GPS samples, location update times and polling fallback. Coordinates/Maps links instead of pretending an unconfigured map is live.
- SQLite local Prisma persistence, production PostgreSQL/PostGIS schema and initial migration, realistic catalogue seed, Redis/BullMQ privacy-retention worker.
- Docker/Render/CI templates, environments, setup/deployment docs, tests for pricing, contracts, serviceability, state transitions, signature verification, checkout, auth boundaries, tracking, concurrency and UI flows.

## Priority 1 — production identity, payment and geography

1. Firebase browser SDK Google/phone login, reCAPTCHA/App Check, account linking and staff provisioning UI. The existing client login screens are development-only; backend `/auth/firebase` is implemented.
2. Full Razorpay checkout lifecycle, provider order creation, expiring Redis/DB stock reservations, asynchronous webhook transactions with replay ledger, reconciliation, failure/retry and verified refunds. The Razorpay HTTP/signature adapter exists but is deliberately not wired into checkout.
3. Google Places, reverse geocoding, pin editing, Google map markers, route polylines and provider-derived ETA. Current manual/real-GPS flow and Maps links remain honest fallbacks.
4. Redis-backed distributed rate limits and OTP challenges, per-account abuse limits, trusted-proxy configuration, verified security headers/CSP across production domains, monitoring and threat-model review.
5. Run migrations, rollback drills, concurrency tests and failover tests against real PostgreSQL/Redis; transaction contention retry policy.

## Priority 2 — commerce and operations

Product variant/media/brand normalization; store-specific pricing; store selection on catalogue; opening hours, capacity, delivery slots and polygon zones; inventory reservations; full fine-grained staff roles; courier reject/reassign/failure flow; verified reviews; saved/merged server wishlist; recently viewed; typo-tolerant search; one-time coupons; invoices; account data export/deletion; support tickets; notifications, transactional email/SMS/WhatsApp; validated signed media uploads and storage.

## Priority 3 — operational scale and polish

All requested analytics/comparisons, stock/customer/catalogue CSV import/export and bulk operations, banners/collections CMS, tax/HSN settings, multi-warehouse operations, delivery delay alerts, native driver app for background GPS, push notifications, validated install icons for every PWA platform, optional dark theme, complete dynamic SEO sitemap, independently reviewed business/legal policies and WCAG audit.

## Current limits

- Original legacy files are preserved and excluded from new checks; their old endpoints are not part of Daybasket.
- Development mock login cannot run under NODE_ENV=production. Existing mock users never become production Firebase staff automatically.
- Storefront and API are deployed on Vercel with Neon PostgreSQL; see VERCEL.md for public URLs and verified checks. Admin/delivery apps and the Redis/BullMQ worker are not hosted. Production identity and payment setup remain incomplete; no real payment was performed.
- Maps/email/SMS/storage are not integrated. Placeholder configuration is documented, not represented as finished features.
- Seed photos are illustrative remote Unsplash photos; replace them with owned product photography and accurate pack information before launch.
- Local login cookies are shared by localhost ports. Use separate browser profiles/contexts to demonstrate customer/admin/partner simultaneously.
- Demo tax rates start at zero; verify tax classification, GSTIN and invoices before real commerce. The tax domain math itself is tested.
- PWA manifest and service worker scaffolding intentionally do not cache private order/location data. Full offline completion is not implemented.
