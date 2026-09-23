# Owner and employee Google access

Use the production admin address: https://basket-admin-delta.vercel.app. The Git preview address (`basket-admin-git-main-arhanquikit.vercel.app`) is not an authorized Google sign-in domain and can report `auth/unauthorized-domain`.

Verified on 2026-09-23: opening the production address in Safari restored the existing owner session and loaded the owner dashboard and analytics. All 19 Firebase identity tests passed. A fresh Google sign-in was not completed during this check; the in-app browser did not expose the Google popup. Use Safari or Chrome for Google sign-in.

Open the Vercel **basket-api** project → **Settings → Environment Variables**.

- `ADMIN_EMAILS`: comma-separated Google emails for owners.
- `STAFF_EMAILS`: comma-separated Google emails for employees.

Preserve existing emails when adding another person. Save values for **Production**, then redeploy **basket-api** so they take effect. Never put these lists in frontend `NEXT_PUBLIC_` settings. No invitation email is sent; users sign in with their own approved Google account at https://basket-admin-delta.vercel.app.

Example: `ADMIN_EMAILS=owner@gmail.com,partner@gmail.com` and `STAFF_EMAILS=employee@gmail.com,manager@gmail.com`.

Employees can manage products, photos, stock, orders, deliveries and homepage content, and view store analytics and audit records. They are stored as `staff`, not owners. Access lists are managed through the hosting account; the store admin UI does not grant access to other people.

Removing an email and redeploying blocks its existing staff sessions. Changing between owner and employee requires signing in again. Customer Google sign-in remains open to customers; store access requires an exact approved email, a verified Google email, and a valid Google identity.

If login says the account does not have access, add the exact Google account email to the appropriate list. If Google has not verified that email, finish verification in that Google account. A blocked popup requires allowing popups or using Safari/Chrome.

## Same-tab Google sign-in

Admin sign-in now uses Firebase redirects within the current tab. The admin origin proxies `/__/auth/*` to the configured Firebase project's `firebaseapp.com` helper, keeping the helper storage on the same origin as the app. Only those helper routes allow same-origin framing; dashboard pages retain `X-Frame-Options: DENY`.

Google OAuth must allow `https://basket-admin-delta.vercel.app/__/auth/handler` as an authorized redirect URI. The admin domain must also remain in Firebase Authentication's authorized domains. Other domains require their own exact callback registration before use. The browser uses its current host for `authDomain`; `NEXT_PUBLIC_FIREBASE_PROJECT_ID` selects the upstream helper.

The redirect result is exchanged for the existing backend session once, then the temporary Firebase identity is signed out. Owner and employee allowlists remain enforced by the backend.
