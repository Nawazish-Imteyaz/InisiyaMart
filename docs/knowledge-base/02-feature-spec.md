# 02 · Feature Specification

Priority: **P0** = launch (MVP) · **P1** = soon after launch · **P2** = later

## A. Customer storefront
### Global
| Feature | Priority | Notes |
|---|---|---|
| PIN-code delivery check | P0 | 6-digit PIN → serviceable? + estimated delivery date (Shiprocket API in Stage B) |
| Language: English (Hindi later) | P0 / P1 | Urdu used in branding blocks |
| Header: logo, search, occasions, categories, wishlist, cart, account | P0 | |
| Footer: about, policies, contact, WhatsApp, social, payment icons | P0 | |
| WhatsApp floating button | P0 | |
| Search with autosuggest (EN + AR) | P0 | |

### Pages
| Page | Priority | Key content |
|---|---|---|
| Home | P0 | Campaign hero, shop by occasion, shop by category, best-sellers, craft story strip, makers, reviews, Instagram |
| Category / occasion listing | P0 | Filters: price, craft type, colour, delivery speed, "ready to ship"; sort |
| Product detail | P0 | Gallery + zoom + video, price, delivery estimate by PIN code, personalisation, craft story, maker, materials, dimensions, care, reviews, "complete the gift" |
| Cart | P0 | Edit qty, gift wrap, add-ons, promo code, shipping estimate |
| Checkout (single page, guest allowed) | P0 | Sender → recipient → gift message → delivery → payment |
| Order confirmation + tracking | P0 | |
| Account: orders, addresses, wishlist, reminders | P0 / P1 | Reminders are P1 |
| Maker / artisan page | P1 | Photo, story, products |
| Craft story pages (Black Pottery, Silk weaving…) | P0 | SEO and brand value |
| Corporate gifting | P1 | Enquiry form, bulk pricing, logo customisation |
| Gift finder quiz | P2 | |
| Blog / Craft Journal | P1 | |
| Static: About, Contact, FAQ, Shipping, Returns, Privacy, Terms | P0 | |

### Checkout fields (India)
- Sender: name, email, mobile (+91)
  India: name, mobile (+91), house/flat, street/area, landmark, city, state, 6-digit PIN code (auto-fill city/state from PIN).
- "Send as surprise", so we never contact the recipient before delivery except for address issues
- Hide prices on the packing slip (gift receipt)
- Gift message (character limit) plus card design choice
- Delivery: estimated date window by PIN code; express option later
- Payment: UPI first, cards, COD. See `03-india-market.md`

## B. Seller / maker portal (P1 for the family, P2 for external artisans)
- Add / edit products (EN fields, Hindi later, images, variants, stock, production lead time)
- Order queue: new → in production → packed → handed to courier → delivered
- Print packing slip and shipping label
- Payout report (needed when multi-vendor)

## C. Admin
| Feature | Priority |
|---|---|
| Product, category, occasion, collection management (bilingual) | P0 |
| Orders, refunds, order status notifications | P0 |
| Prices in ₹ (incl. GST), compare-at price for sales | P0 |
| Shipping rates by weight / zone, COD fee, free-shipping threshold | P0 |
| Promo codes, festival campaign banners | P0 |
| Customers, reviews moderation | P1 |
| Reports: sales by state, product and occasion | P1 |
| Vendor management and commissions | P2 |

## D. Notifications
| Event | Channel |
|---|---|
| Order placed / paid | Email + WhatsApp + SMS |
| Shipped (with tracking link) | Email + WhatsApp |
| Out for delivery / delivered | WhatsApp / SMS |
| Occasion reminder | Email / push (P1) |
| Abandoned cart | Email / WhatsApp (P1) |

## E. Non-functional
- Mobile-first, Lighthouse ≥ 90 on mobile
- SEO: structured data (Product, Review, Organization), Hindi pages later with hreflang
- Accessibility: WCAG 2.1 AA
- Analytics: GA4 + Meta Pixel + Microsoft Clarity
- Data protection: India DPDP Act 2023 (verify before launch)
