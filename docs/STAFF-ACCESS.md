# Owner and employee Google access

Open the Vercel **basket-api** project → **Settings → Environment Variables**.

- `ADMIN_EMAILS`: comma-separated Google emails for owners.
- `STAFF_EMAILS`: comma-separated Google emails for employees.

Preserve existing emails when adding another person. Save values for **Production**, then redeploy **basket-api** so they take effect. Never put these lists in frontend `NEXT_PUBLIC_` settings. No invitation email is sent; users sign in with their own approved Google account at https://basket-admin-delta.vercel.app.

Example: `ADMIN_EMAILS=owner@gmail.com,partner@gmail.com` and `STAFF_EMAILS=employee@gmail.com,manager@gmail.com`.

Employees can manage products, photos, stock, orders, deliveries and homepage content, and view store analytics and audit records. They are stored as `staff`, not owners. Access lists are managed through the hosting account; the store admin UI does not grant access to other people.

Removing an email and redeploying blocks its existing staff sessions. Changing between owner and employee requires signing in again. Customer Google sign-in remains open to customers; store access requires an exact approved email, a verified Google email, and a valid Google identity.

If login says the account does not have access, add the exact Google account email to the appropriate list. If Google has not verified that email, finish verification in that Google account. A blocked popup requires allowing popups or using Safari/Chrome.
