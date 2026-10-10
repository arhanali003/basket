# Category management and search — 10 October 2026

## Admin categories

Open **Categories** in the admin sidebar to add or edit a name, photo and
background colour. Photos support the existing upload picker or HTTPS URLs.
Product forms load the current category list when opened.

Empty categories can be deleted after confirmation. Categories with linked
products require an explicit destination category. The API moves every linked
product, including archived/soft-deleted listings, and deletes the category in
one transaction. Products, inventory, baskets and historical orders are not
deleted. Duplicate category names are rejected irrespective of case or repeated
spaces; admin/staff permissions and audit logging apply to all mutations.

Endpoints: `GET/POST /api/v1/admin/categories` and
`PUT/DELETE /api/v1/admin/categories/:id`. No database migration is needed.

## Storefront search

The full active catalogue is available to search; the previous silent 100-product
cutoff is removed. A shared matcher ranks names, brands, category names, pack
sizes and descriptions. It supports multiple words in any order, normalizes
case/spacing/punctuation, and offers single-letter typo matches when there are
no exact matches. Exact matches take priority.

Live suggestions support mouse, touch and keyboard arrows/Enter/Escape. Results
appear above the promotional content while typing; customers can clear search,
filter by category and sort prices. The category navigation uses API categories,
including uploaded photos, rather than hard-coded names. Returning to the
storefront tab refreshes the catalogue while retaining search and basket state.

This approach fits the current small-store catalogue. A substantially larger
catalogue should use indexed server search with pagination instead of loading
every active product into the browser.

## Verification and preview

- All 64 unit tests pass, including 23 search cases.
- Category API integration tests verify authorization, validation, CRUD and safe
  product movement with preserved stock, basket and order records.
- Focused browser checks cover category dialogs, live search, keyboard/mouse/touch
  suggestions, custom categories, and the earlier asset-recovery behavior.
- All four production builds pass; desktop and mobile previews were inspected.

The admin UI is tested locally in development mode because production Google
sign-in needs the private Firebase configuration. The storefront browser checks
use its production build. The local admin demo password remains
`daybasket-local-only`; this login is disabled in production.

These changes were deployed to the existing storefront, admin and API Vercel
projects from commit `c568c0c` on 10 October 2026. Live storefront search, API
readiness and the admin login page were checked. See `CI-REPAIR.md` for the
subsequent full-suite and browser-reliability corrections.
