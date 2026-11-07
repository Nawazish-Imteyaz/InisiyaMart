# 010 · Open handmade marketplace (many sellers)

- **Date:** 2026-11-07
- **Status:** accepted (prototype first; legal set-up before real money flows)
- **Context:** The family can make only a few products, which is not enough choice for buyers. Many people across India
  (housewives, girls, students, village artisans, city makers) make beautiful handmade things but have no easy place to sell.
  The owner wants Insi House to become a marketplace like Amazon / Flipkart, but **handmade only**, much simpler for sellers,
  and open to low-tech village makers.
- **Options considered:**
  1. Stay a single-family shop (rejected: too few products).
  2. Curated marketplace: makers apply, admin approves sellers and their first products (chosen for launch).
  3. Fully open sign-up with no approval (rejected for now: fake / non-handmade sellers).
- **Decision:**
  - Anyone can register as a seller from their normal customer account ("Become a seller"); 5 simple steps.
  - **Handmade only.** Every product says who made it, the technique and the region. Admin approves new sellers and their first products.
  - **0% commission** at the start (owner, 2026-11-07). A small commission may come after launch: `TODO(owner)`.
  - **GST optional** for sellers (owner, 2026-11-07). Sellers may add GSTIN / enrolment ID; nothing is forced in the prototype.
  - **India first.** Other countries later.
  - Sellers ship with any courier and enter the tracking number; Shiprocket per-seller pickup later.
  - Each seller has their own dashboard (products, orders, earnings). The server checks the seller on every request,
    so no seller can see, change or delete another seller's data. The admin sees everything.
  - Fixed category tree; sellers can request a new category (product goes under "Other" while waiting).
  - The family's products become the first shop, "Insi House Originals".
  - **Prototype first:** fully working site, but before real buyer money for other sellers flows, the owner registers the business,
    gets GST (as e-commerce operator) and switches payments to a split-payment provider (see `10-marketplace-plan.md` §9).
- **Consequences:**
  - Product and shop pages load live from the database (no website rebuild for every seller change).
  - Orders are split per seller (one cart, many sellers).
  - New tables: sellers, seller_orders, category_requests, reviews, payouts. Existing data migrates to seller #1.
  - Docs to update after the prototype: CLAUDE.md "What we are building", 00-project-overview, 02-feature-spec, 05-tech-architecture, 06 legal.
