# 00 · Project Overview

## Vision
Bring the handmade, culturally rich crafts of **Azamgarh, Uttar Pradesh** to gift-givers across the **GCC**,
through a polished, Bleems-style gifting experience: browse by occasion, add a personal message, and send it
to someone special.

## Who we are
- A **family business**. Family members create the products (artisans / designers).
- Brand name: **Insi House** (Arabic: **بيت إنسي**), handle/domain `insihouse`. Named after the owner's niece
  **Insiya** (إنسية, "warm, affectionate, close companion", from the Arabic root *uns*, meaning closeness).
- Logo and story: **TODO(owner)**, see `08-brand-intake.md`.

## Target customers
| Segment | Why they buy | Notes |
|---|---|---|
| South Asian expats in GCC (India / Pakistan / Bangladesh) | Nostalgia, cultural connection, weddings, Eid | Large, high-intent segment; also comfortable in English, Hindi and Urdu |
| GCC nationals (Kuwaiti, Saudi, Emirati…) | Unique handmade gifts, home décor, Ramadan / Eid gifting | Arabic-first UX, premium packaging matters |
| Corporate buyers | Ramadan / Eid hampers, employee and client gifts | Bulk orders, custom branding, invoices |
| Other expats | Distinctive décor and gifts | English-first |

## Business model (initial)
- **Direct-to-consumer (D2C)** store run by the family. One "seller" at first.
- Built **marketplace-ready**, so later we can onboard more Azamgarh / UP artisans as vendors, like Bleems
  onboards many shops. Bleems is a multi-vendor marketplace.
- Revenue: product margin, gift add-ons (wrapping, cards, chocolates), express shipping fees, and corporate orders.

## Key differentiator vs Bleems
| Bleems | Us |
|---|---|
| Flowers, cakes and gifts from **local** GCC shops | **Handmade cultural crafts** from Azamgarh, India |
| Same-day / time-slot delivery | Cross-border, so ship-from-India **or** a local GCC stock hub (see decision D-001) |
| Many vendors | Family brand first, artisan marketplace later |
| Generic gifting | **Story-led**: every item has a craft, maker and heritage story |

## Critical open decisions
| ID | Decision | Options | Recommendation |
|---|---|---|---|
| D-001 | Fulfilment model | (a) Ship every order from India (5–10 days) · (b) Keep stock in one GCC hub (e.g. Kuwait) for fast local delivery + ship from India for the rest · (c) Hybrid | **(c) Hybrid**: start with (a), add a Kuwait/UAE hub for best-sellers once demand is proven |
| D-002 | Platform | Custom (Next.js + Medusa) vs hosted (Shopify) | See `05-tech-architecture.md` |
| D-003 | Launch countries | All 6 at once vs start with 1–2 | Start with **Kuwait + UAE** (or wherever family contacts are), then expand |
| D-004 | Legal entity | Indian exporter only vs also a GCC company | Depends on D-001; consult an accountant |

## Open questions for owner
- [x] Brand name: Insi House (decided 2026-11-03)
- [ ] Logo, colours, tagline (see `08-brand-intake.md`)
- [ ] Is `insihouse.com` (or .co / .shop) available? Is `@insihouse` free on Instagram, Snapchat and TikTok?
- [ ] Which products exactly, with prices and production capacity per month?
- [ ] Does anyone in the family live in or have a partner in a GCC country (for local stock or returns)?
- [ ] Is there an existing company or GST registration / IEC in India?
- [ ] Budget and target launch date?
- [ ] Will other artisans sell on the site later (marketplace) or only the family?
