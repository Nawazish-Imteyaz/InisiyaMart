# 002 · Start on Cloudflare free tier, upgrade later

- **Date:** 2026-11-03
- **Status:** proposed (awaiting owner confirmation)
- **Context:** Owner wants to launch for free for the first few months, then pay for proper hosting later.
- **Constraint:** Medusa v2 (the full commerce backend in `05`) needs an always-on Node.js server + PostgreSQL + Redis.
  It **cannot run on Cloudflare Workers**. Free "sleeping" servers (e.g. Render free) are too slow for a shop.
- **Decision (proposed):** two stages.
  - **Stage A: free on Cloudflare (~$0 + domain).** Bilingual catalogue website (Next.js via OpenNext on Cloudflare,
    images in R2, product data in D1 or a CMS). Customers order through **WhatsApp / an order-request form**, and payment
    is taken by payment link. No cart or online checkout yet.
  - **Stage B: full shop.** Add Medusa backend + Postgres + Redis on paid hosting (~$25–60/mo), add cart, checkout and
    payment gateway. The Stage A storefront code is **reused**; only its data source changes from D1/CMS to Medusa.
- **Consequences:**
  - Keep the storefront's data access behind one `lib/catalog` layer so switching to Medusa in Stage B is easy.
  - Cloudflare free plan has tight limits (e.g. Worker CPU time and bundle size). If Next.js exceeds them, use
    **Workers Paid (~$5/mo)**. Check current limits.
  - "Later hardware" = upgrading to paid cloud plans. No physical servers need to be bought.
