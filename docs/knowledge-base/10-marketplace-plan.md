# 10 · Marketplace plan: Insi House for every maker in India

Decision 010 (2026-11-07). Research: marketplace patterns (Etsy, Meesho, Amazon Karigar, Flipkart Samarth, iTokri, Okhai,
GoCoop, ONDC) and Indian law/payments (GST, E-Commerce Rules, RBI PA Directions 2025, DPDP, TDS). Sources are in §12.
Patterns only: nothing copied from any site.

## 1. Vision
**"Haath ka bana, dil se becha": handmade by India, bought by India.**
A handmade-only marketplace where anyone who makes things by hand (housewives, girls, students, village artisans, city makers)
can open a shop in 5 minutes from a phone, and buyers find unique gifts with the maker's story on every product.
Simpler than Amazon/Flipkart for sellers; warmer and more personal for buyers (Bleems-style gifting stays).

## 2. Who uses it
| Role | Can do | Login |
|---|---|---|
| Buyer | browse, wishlist, cart (many sellers), checkout, track, review after delivery | phone + password / OTP (existing) |
| Seller | own shop page, add/edit own products, see own orders, mark shipped, earnings, request categories | **same account** + "Become a seller" |
| Admin (owner/staff) | approve sellers & products, categories, all orders, disputes, block sellers, settings | existing admin console |
| Seller Saathi (later) | helper who manages several village makers' shops | seller account with linked makers |

## 3. Become a seller: 5 steps (phone first, big buttons)
1. **Log in** with mobile number (existing account).
2. **Your shop**: shop name, your name, city/district, state, PIN, one photo, 2-line story ("I make…").
3. **First product**: photo(s), name, price, category, "Who made it?" (me / my family / my group), technique, stock.
4. **How you get paid**: UPI ID (required for the prototype), bank details optional. PAN optional now (required before real launch).
5. **Tax (optional)**: "I have GST" → GSTIN, or "GST enrolment ID", or "Not yet". Tick the seller undertaking ("my products are handmade,
   information is true") → **Submit for approval**.
Shop status: `pending → approved / changes needed / rejected → suspended`. First 5 products of a new seller go to admin review;
after that products publish straight away (admin can still hide anything).

## 4. Seller dashboard (`/seller/`)
Tabs with large icons: **Home** (today's orders, earnings, tips) · **Products** (add / edit / stock / hide) · **Orders**
(new → packed → shipped with courier + tracking → delivered) · **Earnings** (per order ledger) · **Shop** (profile, story, photo,
holiday mode) · **Help** (WhatsApp support). Hindi/Urdu labels later (§10).
**Data isolation rule:** every `/api/seller/*` query is filtered by the seller id taken from the login session on the server.
A seller can never pass another seller's id. Photos are stored under `s/<sellerId>/…`.

## 5. Products, categories, handmade proof
- Category tree (parent → child) seeded craft-first: Pottery & clay · Embroidery & textiles · Handloom · Jewellery · Home décor ·
  Paintings & art · Wood & bamboo · Paper & stationery · Gifts & hampers · Food made at home (later, needs FSSAI) · Other.
- Required on every product: who made it, technique, district/state, materials, size; optional "made to order (days)".
- **Request a category**: seller picks "Other" + writes the category name; product can still go live; admin approves / merges / rejects.
- Country of origin = India (shown, required by law).

## 6. Buyers: discovery and trust
Home rails: occasions (existing), new from makers, crafts by region/state, featured makers (admin-curated).
Product page: maker card ("Made by Rehana, Azamgarh · embroidery"), **More from this maker**, **Same craft, other makers**,
**From the same district**, recently viewed (on the device). Search with filters (category, price, state, made-to-order).
Reviews only from delivered orders (with photo). Seller badge later ("Trusted Maker": fast dispatch, good ratings).

### Seller privacy: "show the maker, hide the private details" (owner question, 2026-11-07)
- **Public:** shop name, maker's first name, optional photo (seller chooses), district + state, story, ratings, products.
- **Admin only:** full name, home address, mobile, email, PAN, GST, bank/UPI details, KYC.
- Buyers contact sellers through Insi House (messages / support WhatsApp), never the seller's personal number.
- Seller onboarding advises a UPI ID without the phone number (e.g. `name.shop@okaxis`): in the pay-the-maker prototype the
  buyer's UPI app shows the payee name / ID. Goes away with split payments (phase 4).
- Law: E-Commerce Rules require seller name, address, contact and GST status to be shown to buyers (stricter from 1 Jan 2027).
  `TODO(owner)` + lawyer: confirm the minimum public display for home-based individual sellers (e.g. full address on the
  invoice/order page after purchase instead of on the public shop page).

## 7. Cart, orders and money (prototype)
- One cart, many sellers → one **order** for the buyer, split into **seller orders** (one per seller), each with its own
  shipping fee (set by the seller), status and tracking.
- **Prototype payment = pay the maker directly**: at checkout each seller order shows that seller's UPI ID / QR. The buyer pays
  each maker, enters the UTR; the **seller** confirms "money received". Cash on delivery per seller if the seller allows it.
  Insi House never holds other sellers' money → no payment-aggregator issue, 0% commission is natural.
  (`TODO(owner)` + CA: confirm this "lead/listing platform" model keeps TCS/TDS off until we collect payments.)
- Insi House Originals (family shop) keeps the current UPI flow.
- **Later (before scaling):** switch to a split-payment provider (Cashfree Easy Split first; Razorpay Route needs ₹40 lakh turnover),
  where Insi House collects one payment, holds each seller's share until delivery/returns close, and pays out automatically.

## 8. Shipping
Prototype: each seller sets a flat shipping fee (or free above X) and dispatch days; ships with any courier/India Post and enters
courier + tracking. India only. Later: Shiprocket with one pickup address per seller (no extra cost), labels from the dashboard.
International later, only under Insi House's own IEC/GSTIN (Insi House buys and exports): makers cannot export without GSTIN+IEC.

## 9. Legal: prototype vs real launch
**Prototype (now):** invited / approved sellers, GST optional, pay-the-maker-directly, policy pages with `TODO(owner)` placeholders.
Data fields already built: seller PAN, GST type (`none` / `enrolment` / `gstin`), GSTIN/enrolment ID, state, HSN (optional).
Switch `enforce_gst_rules` (admin setting, OFF in prototype): when ON, sellers without GSTIN can only sell to buyers in their own
state, and sellers with no GSTIN and no enrolment ID cannot go live (Notifications 34/2023 and 37/2023).
**Before real launch / collecting payments:** see checklist §11. Must be done before **1 Jan 2027** for the 2026 E-Commerce amendment items.

## 10. Low-tech sellers (village makers)
Phone-first, few words, big buttons, photo-first listing ("take 3 photos → price → done"), voice-note description later,
WhatsApp help button everywhere. Hindi and Urdu interface (phase 5). **Seller Saathi**: a helper (NGO, SHG leader, family member)
who registers and manages shops for several makers. WhatsApp listing bot later.

## 11. Checklist before money for other sellers flows (owner)
1. Business entity + PAN; GSTIN as e-commerce operator (no turnover threshold); TAN.  `TODO(owner)`
2. Split-payment provider live (Cashfree Easy Split / Razorpay Route); seller KYC = PAN + verified bank; no pooling in own account.
3. Every seller: PAN + (GSTIN or GST enrolment ID); `enforce_gst_rules` ON.
4. Monthly GSTR-8 (TCS 0.5%, GSTIN sellers only); TDS 0.1% (s.393 new Act, old 194-O) after ₹5 lakh per seller per year.
5. Seller agreement; seller details + GST status + country of origin on product page; grievance officer (48 h / 1 month);
   ranking explanation; 30-day lowest "was" price; no dark patterns; National Consumer Helpline (2026 amendment, from 1 Jan 2027).
6. No Aadhaar storage; KYC data encrypted, admin-only; privacy notice (DPDP duties from ~May 2027).
7. Written CA + lawyer opinion on UNVERIFIED points (handicraft inter-state exemption via marketplace; pay-the-maker model; TCS registration per state).

## 12. Build phases
| Phase | What | Result |
|---|---|---|
| **1. Sellers & shops** | sellers table, Become-a-seller (5 steps), seller dashboard: shop + products, admin approval queues, category requests, products owned by sellers, live product/shop pages (no rebuilds), family → seller #1 | makers can join and list |
| **2. Multi-seller orders** | cart split by seller, seller orders, pay-the-maker UPI per seller, seller confirms payment, seller ships + tracking, buyer tracking per seller, earnings ledger | real orders flow |
| **3. Trust & discovery** | reviews (delivered only), maker cards & rails, search + filters, region pages, seller stats, notifications (Telegram/WhatsApp) | buyers find & trust |
| **4. Go-live legal** | checklist §11, split payments, KYC, GST rules ON, Shiprocket per-seller pickup, Turnstile, custom domain | ready for real money |
| **5. Reach** | Hindi/Urdu, Seller Saathi, WhatsApp listing, international via Insi House export | more makers, more buyers |

### Phase 1 status (2026-11-07, branch `marketplace`, NOT live yet)
Built and tested locally: `/sell/` landing, `/seller/` (5-step sign-up + dashboard: home, products with photos, shop settings, help),
live `/product/?s=` and `/maker/?s=` pages (old `/product/<slug>/` links redirect), maker card + "more from this maker / same craft /
same district" rails, live shop grid, admin **Sellers** (approve / ask changes / reject / pause, private details, activity log),
**Products to check**, **Category requests**. Checkout accepts only Insi House Originals products until phase 2 (no pooling of
other sellers' money). Tests: `scripts/marketplace-test.mjs` 36/36, `scripts/security-test.mjs` 32/32 (local only).
**To go live:** (1) owner says go; (2) run `node scripts/d1-remote.mjs db/migrations/0004_marketplace.sql` on the live D1 FIRST
(the new code needs the `sellers` table; without it the build stops safely); (3) merge `security-review` + `marketplace` into `main`.

## 13. Technical structure (summary)
- Keep: Cloudflare Pages + Functions + D1 + R2, Next.js static shell, admin console, customer accounts, security fixes (branch `security-review`).
- Change: product, shop and category pages load data **live** from `/api` (Pages Function serves `/product/<slug>/` and
  `/shop/<slug>/` with the right title/meta for Google), so sellers' changes appear instantly with no rebuild.
- New tables: `sellers`, `seller_orders`, `category_requests`, `reviews`, `seller_ledger`; new columns: `products.seller_id`,
  `products.review_status`, handmade fields, `categories.parent_id`, `orders` → parent of `seller_orders`.
- New API: `/api/seller/*` (seller session, own data only), `/api/shops/*`, `/api/products` (search), admin `sellers`, `reviews`, `category-requests`.
- Migration `0004_marketplace.sql`: existing products → seller #1 "Insi House Originals"; existing orders → seller orders of seller #1.
- Tests: extend `scripts/security-test.mjs` with seller-isolation attacks (seller A edits/deletes/reads seller B's product, order, earnings).

Sources: see decision 010 research reports (Etsy help, sell.amazon.in/karigar, Notifications 34/2023, 37/2023, 56/2018-CT,
15/2024-CT, RBI PA Directions 15 Sep 2025, razorpay.com/docs/payments/route, cashfree.com/docs/payments/split, CCPA dark-pattern
guidelines 2023, E-Commerce (Amendment) Rules 2026, DPDP Rules 2025, Shiprocket multiple pickup locations).
