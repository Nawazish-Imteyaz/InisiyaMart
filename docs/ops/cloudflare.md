# Cloudflare setup (hosting, database, photos)

Last updated: 2026-11-04. **No secrets in this file. The repo is public.**

| Item | Value | Status |
|---|---|---|
| Pages project | `insihouse`, built from GitHub `main`, root `apps/storefront`, output `out` | Live at https://insihouse.pages.dev |
| D1 database | `insihouse-db` (id `fb46cfd6-3107-40b5-870f-9e79dc723c71`, region hint APAC) | Schema `db/migrations/0001_init.sql` + sample data applied |
| R2 bucket | `insihouse-photos` (APAC) | Created, holds product/category photos |
| Deploy hook | `admin-save` on branch `main` | Set as encrypted Pages secret `DEPLOY_HOOK_URL` (production) |
| Old Worker `inisiyamart` | Failed earlier attempt | Owner to delete |

## Where secrets live
- All local secrets: `.secrets/cloudflare.env` (git-ignored, on the owner's PC only).
- `CLOUDFLARE_API_TOKEN`: Windows user environment variable on the owner's PC (token `insihouse-admin`: D1, R2, Pages edit). Roll it in the dashboard (My Profile → API Tokens) if it leaks.
- Deploy hook URL: in `.secrets/cloudflare.env` and set as the encrypted Pages secret `DEPLOY_HOOK_URL`.
- First owner login: `.secrets/admin-login.txt`.

## Admin console
- URL: https://insihouse.pages.dev/admin/
- Add or reset a login: `node scripts/create-admin.mjs <email> "<name>" owner|staff [password] > x.sql`, then `node scripts/d1-remote.mjs x.sql` (run inside `apps/storefront`, delete `x.sql` after).
- Run SQL on the live DB: `node scripts/d1-remote.mjs -e "SELECT ..."` (reads `.secrets/cloudflare.env`).
- Schema changes: add `db/migrations/000N_name.sql` and run it with `d1-remote.mjs`.

## Local testing
Install wrangler into a tools folder with PowerShell (`npm install wrangler`; Bash has no cmd.exe), then inside `apps/storefront`:
1. `wrangler d1 execute insihouse-db --local --file db/migrations/0001_init.sql` (then `db/seed.sql`)
2. `CATALOG_OFFLINE=1 node node_modules/next/dist/bin/next build`
3. `wrangler pages dev out --port 8788` → http://localhost:8788/admin/

## GitHub Pages
Retired on 2026-11-04 (workflow removed). The old github.io link shows the last copy and can be switched off in repo Settings → Pages.

## v2: accounts, partner keys, security (decision 009)

| Item | Where |
|---|---|
| Encryption key for partner keys | Pages secret `SECRETS_KEY` (64 hex). Local copy in `.secrets/cloudflare.env`. Set once with `node apps/storefront/scripts/set-secrets-key.mjs`. **Never change it** (saved keys would need re-entering). |
| Partner keys (Razorpay, Shiprocket, WhatsApp…) | Admin → Settings → Payments / Shipping / WhatsApp & SMS. Stored encrypted in D1 table `integrations`. |
| Incoming webhooks | `/api/hooks/razorpay`, `/api/hooks/courier` (Shiprocket), `/api/hooks/whatsapp`. Log: table `webhook_log`, shown in the admin. |
| Customer accounts | `/api/account/*`, cookie `ih_cust`, tables `customers`, `customer_sessions`, `customer_addresses`, `otp_codes`. |
| Security headers | `apps/storefront/public/_headers` (pages) and `json()` in `functions/_lib/util.ts` (API). |
| Prefetch fix | `scripts/flatten-rsc.mjs` runs after `next build` (in `npm run build`). |

Local testing: add `--binding SECRETS_KEY=<64 hex>` to the `wrangler pages dev` command.
Server type-check: `node node_modules/typescript/bin/tsc -p functions/tsconfig.json`.
