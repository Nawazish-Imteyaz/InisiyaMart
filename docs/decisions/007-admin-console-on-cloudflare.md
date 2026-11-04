# 007 · Admin console on Cloudflare (D1 + R2 + Pages Functions)

**Date:** 2026-11-04 · **Status:** accepted

## Decision
The family manages the store from an admin console at `/admin` (https://insihouse.pages.dev/admin/).
Everything runs on the Cloudflare free plan:

| Part | Service |
|---|---|
| Website (static Next.js export) | Cloudflare Pages project `insihouse` |
| Admin API, catalogue API, photo server | Pages Functions in `apps/storefront/functions/` |
| Data (categories, products, orders, team, settings, activity) | D1 database `insihouse-db` |
| Product and category photos | R2 bucket `insihouse-photos`, served at `/img/...` |

GitHub Pages preview is retired (workflow removed); Cloudflare is the only host.

## How a change reaches the website
1. Admin saves → D1/R2 updated immediately.
2. The API calls the Pages **deploy hook** (secret `DEPLOY_HOOK_URL`), at most once every 3 minutes
   (free plan: 500 builds/month). The admin shows "Changes waiting" and retries automatically.
3. During the build, `next.config.ts` downloads `/api/catalog` into `src/data/generated/catalog.json`,
   so every product gets a real static page (`/product/<slug>/`) that Google and WhatsApp previews can read.
   If the API fails during a Cloudflare build, the build stops and the old site stays live.

## Admin features (v1)
Login/logout (email + password, PBKDF2, 7-day HttpOnly session, rate-limited per device), dashboard,
categories (add/edit/delete, colour, photo), products (add/edit/delete, up to 12 photos resized in the browser,
₹ price + MRP, stock or made-to-order, on website/hidden/draft, occasions, collection), orders (manual entry from
WhatsApp, status flow new → delivered, payment + UPI reference, courier + AWB + tracking link, history,
WhatsApp update message, automatic stock changes), team (owner/staff roles), settings (WhatsApp number, email,
Instagram, UPI ID, announcement bar, delivery line), activity log.

## Not yet (next decisions)
Customer cart + checkout, customer login (WhatsApp "reverse OTP"), UPI payment links, Shiprocket, customer "Track my order" page.
