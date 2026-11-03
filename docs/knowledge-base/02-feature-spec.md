# 02 · Feature Specification

Priority: **P0** = launch (MVP) · **P1** = soon after launch · **P2** = later

## A. Customer storefront
### Global
| Feature | Priority | Notes |
|---|---|---|
| Country selector (KW, SA, AE, QA, BH, OM) | P0 | Sets currency, VAT, shipping, payment methods. Auto-detect by IP, user can change |
| Language EN / AR with full RTL | P0 | Hindi/Urdu optional (P2) for expat audience |
| Header: logo, search, occasions, categories, wishlist, cart, account | P0 | |
| Footer: about, policies, contact, WhatsApp, social, payment icons | P0 | |
| WhatsApp floating button | P0 | |
| Search with autosuggest (EN + AR) | P0 | |

### Pages
| Page | Priority | Key content |
|---|---|---|
| Home | P0 | Campaign hero, shop by occasion, shop by category, best-sellers, craft story strip, makers, reviews, Instagram |
| Category / occasion listing | P0 | Filters: price, craft type, colour, delivery speed, "ready to ship"; sort |
| Product detail | P0 | Gallery + zoom + video, price, delivery estimate per country, personalisation, craft story, maker, materials, dimensions, care, reviews, "complete the gift" |
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

### Checkout fields (GCC-specific)
- Sender: name, email, phone (with country code)
- Recipient: name, phone, **country, city / governorate, area, block, street, building, floor / flat, landmark/notes**.
  Kuwait uses governorate/area/block; KSA has the National Address (short code). Make fields country-aware.
- "Send as surprise", so we never contact the recipient before delivery except for address issues
- Hide prices on the packing slip (gift receipt)
- Gift message (character limit) plus card design choice
- Delivery: estimated date window (cross-border) or date + slot (local hub stock)
- Payment: see `03-gcc-market.md`

## B. Seller / maker portal (P1 for the family, P2 for external artisans)
- Add / edit products (EN + AR fields, images, variants, stock, production lead time)
- Order queue: new → in production → packed → handed to courier → delivered
- Print packing slip and shipping label
- Payout report (needed when multi-vendor)

## C. Admin
| Feature | Priority |
|---|---|
| Product, category, occasion, collection management (bilingual) | P0 |
| Orders, refunds, order status notifications | P0 |
| Prices per country / currency (auto-convert + manual override) | P0 |
| Shipping rates and zones per country | P0 |
| Promo codes, banners per country and campaign | P0 |
| Customers, reviews moderation | P1 |
| Reports: sales by country, product and occasion | P1 |
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
- SEO: hreflang per country and language, structured data (Product, Review, Organization), Arabic slugs or transliteration
- Accessibility: WCAG 2.1 AA
- Analytics: GA4 + Meta Pixel + TikTok Pixel + Snapchat Pixel (Snapchat is big in KSA and Kuwait)
- Data protection: comply with KSA PDPL, UAE PDPL, and India DPDP Act (verify before launch)
