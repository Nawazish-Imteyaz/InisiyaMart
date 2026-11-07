# Security review — 7 Nov 2026

Branch: `security-review`. Scope: all Pages Functions (`apps/storefront/functions`), admin console, storefront, Cloudflare config.
Method: white-box code review of every server file + black-box attacks against a **local** copy of the site
(`wrangler pages dev` + local D1). Production received only read-only GET requests (headers, TLS, exposed files).
Backup of the live D1 taken first: `.secrets/backups/insihouse-db-2026-11-07-11-48.sql` (git-ignored).

**Overall risk: LOW–MEDIUM.** No Critical or High issues. The core is well built: server-side pricing, atomic
stock/coupon claims, prepared SQL everywhere, hashed session tokens, HttpOnly/Secure/SameSite cookies, CSRF checks,
signed webhooks, magic-byte upload checks, private R2 bucket, no secrets in git history or the built site.

## Findings

| ID | Issue | Severity | Location | Status |
|---|---|---|---|---|
| SEC-01 | One visitor can lock up all stock with fake unpaid UPI orders (held 48 h, a fake UTR stops the auto-release) | Medium | `functions/api/order/[[path]].ts` placeOrder | **Fixed** (max 2 open unpaid orders per device and per mobile). Partial: many devices still possible → see owner actions 3–4 |
| SEC-02 | A stolen admin session could switch on 2-step login with the attacker's phone and lock the owner out | Medium | `functions/_lib/admin-more.ts` `2fa/enable` | **Fixed** (password required) |
| SEC-03 | Admin password guessing spread over many IPs was not limited (limit was per IP only) | Medium | `functions/api/admin/[[path]].ts` login | **Fixed** (20 fails/15 min per email → only previously-used devices may try) |
| SEC-04 | "Once per customer" coupon could be used twice by sending orders at the same moment (check-then-insert gap) | Medium | `functions/api/order/[[path]].ts` placeOrder | **Fixed** (re-check after insert; later order removed). Race itself UNVERIFIED (local server runs requests one by one) |
| SEC-05 | Very common passwords ("password", "12345678", own phone number) accepted | Low | account + admin `newPassword` | **Fixed** |
| SEC-06 | OTP codes hashed with a key written in the public code when `SECRETS_KEY` is missing | Low | `functions/api/account/[[path]].ts` codeHash | **Fixed** (HMAC with SECRETS_KEY, no fallback) |
| SEC-07 | Static pages sent `Access-Control-Allow-Origin: *` (Pages default) | Low | `public/_headers` | **Fixed** — confirm on production after deploy |
| SEC-08 | No alert when someone logs in to the admin from a new device | Low | admin login | **Fixed** (Telegram alert) |
| SEC-09 | Passwords use PBKDF2-SHA256 at 100,000 iterations (target 600k) | Low | `functions/_lib/util.ts` hashPassword | Accepted — 100k is the Cloudflare Workers maximum; unique salts + rate limits |
| SEC-10 | 2-step login is optional, owner account may not have it on | Medium | admin | Owner action 1 |
| SEC-11 | No CAPTCHA (Turnstile) / WAF rate limiting; not possible on a `*.pages.dev` address | Medium | Cloudflare | Owner action 3 |
| SEC-12 | Site CSP allows inline scripts (`'unsafe-inline'`) | Low | `public/_headers` | Unfixed — needed by the Next.js static export |
| SEC-13 | Password sign-up does not prove the mobile number (someone can register another person's number) | Low | `/api/account/register` | Unfixed — fixed automatically once WhatsApp/SMS codes are on (code login removes the squatter) |
| SEC-14 | TOTP secrets stored unencrypted in D1 | Low | `admin_users.totp_secret` | Unfixed (needs DB access to exploit) |
| SEC-15 | Checkout saves the delivery address in browser storage (shared phones) | Info | `CheckoutForm.tsx` | Unfixed (convenience) |
| SEC-16 | Staff can mark orders Paid and see all customer details | Info | admin roles | By design — give staff logins only to trusted family |
| SEC-17 | Coupon use count is not given back when an order is cancelled | Info | coupons | Business choice |
| SEC-18 | There is no separate TEST environment on Cloudflare | Info | `wrangler.toml` | Owner action 5 |

## Proof (attack re-run)
`scripts/security-test.mjs` runs 32 attacks. Before fixes: 4 vulnerable (SEC-01, 02, 05, + harness checks).
After fixes: **32/32 blocked**, and normal use still works (sign-up, checkout by a real buyer, owner 2FA, owner login during an attack).

## Owner actions (manual)
1. **Turn on 2-step login** for every owner account (Admin → Security). Then delete `.secrets/admin-login.txt`.
2. **Switch on Telegram alerts** (Admin → Settings → WhatsApp & SMS → Telegram) so you get order + new-device login alerts.
3. **Custom domain** (e.g. insihouse.in) on Cloudflare: then add WAF rate-limiting rules for `/api/admin/login`, `/api/account/*`, `/api/order*` and Turnstile on login/sign-up/checkout. Not available on `pages.dev`.
4. **Razorpay checkout** (pay before stock is held) is the real fix for fake-order stock holds; meanwhile set "hold unpaid orders" to 6–12 hours in Settings.
5. Optional: a preview environment with its own D1 `insihouse-db-test` + R2 bucket for future tests.
6. Rotate nothing: no secret was ever exposed (checked live values against all git history and the built site).
7. Customers with a WhatsApp/SMS code in flight at deploy time must request a new code (hash format changed).

## Checked and passed
Secrets (repo, history, bundle, `.gitignore`) · password hashing salted + constant-time compare · no user enumeration
(admin + customer login) · login rate limits · session tokens 256-bit random, hashed, rotated on login, killed on
logout/password change · cookies HttpOnly/Secure/SameSite · no admin access with no session / customer session ·
staff blocked from owner routes · IDOR on orders, addresses, payment reports · mass assignment · SQL injection
(all queries bound) · no `dangerouslySetInnerHTML`/`eval` · R2 path traversal · price/total/discount/payment tampering ·
quantity abuse · stock oversell race · 1-use coupon race · order-lookup brute force · fake Razorpay/Shiprocket webhooks,
wrong amount/currency · CSRF (store + admin) · CORS on API · upload of SVG/HTML disguised as images · huge/nested JSON ·
HTTPS redirect + HSTS · security headers · no exposed `.env`/`.git`/source maps · R2 bucket private · preview
deployments have no database access · `npm audit`: 0 vulnerabilities (Next 16.4.5 patch available).
