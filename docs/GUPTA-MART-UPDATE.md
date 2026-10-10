# Gupta Mart update — 10 October 2026

The storefront, admin and delivery interfaces now use Gupta Mart, including
page titles, app manifests, favicons and Apple home-screen icons. The new vector
logo combines a grocery bag, a G and an orange leaf. Internal package names,
storage keys and local database filenames are unchanged so saved baskets and
existing application wiring remain compatible.

## Returning to a suspended tab

`packages/ui/src/asset-recovery.tsx` checks on initial load, page restoration,
visibility changes and reconnection. It retries failed/missing stylesheets in
their original cascade order and retries completed failed images. Healthy pages
retain their DOM, basket and typed input without reloading. Offline pages wait
for reconnection. If a deployment's CSS remains unavailable but fresh HTML is
reachable, one reload per stylesheet version is allowed, guarded in session
storage to prevent a reload loop.

The existing service workers do not cache requests. Their update requests now
bypass cached worker scripts, and `/sw.js` is served with `no-store`; this is
preventive and is not evidence that the worker caused the reported failure.

## Validation

- Lint, TypeScript checks and all four production builds passed.
- All 41 unit tests passed.
- Six focused Chromium mobile-viewport tests cover healthy resume, missing CSS,
  partial CSS/cascade order, failed images, offline/reconnection, and unavailable
  CSS with guarded reload and saved basket preservation.
- Desktop and 390px phone screenshots inspected; all 16 demo product cards load,
  no horizontal overflow and no page JavaScript errors observed.

The browser tests simulate resource loss and lifecycle events. Physical-phone
browser/OS eviction has not been reproduced; verify the original scenario on
the affected device after publishing. Changes are local; no GitHub push,
production database change or Vercel deployment was performed.
