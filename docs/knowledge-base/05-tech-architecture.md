# 05 · Technical Architecture: Insi House

> Default plan = **custom build** (Bleems-level, marketplace-ready).
> A Shopify alternative is described at the end. Final choice = decision D-002 (pending owner).
> Prices are rough estimates from Nov 2026. Check current pricing before you sign up.

## 1. Big picture

```
                         CUSTOMERS (phone / laptop, GCC)
                                     │
                     insihouse.com  ─┼─  Cloudflare (DNS, CDN, SSL, security)
                                     │
                 ┌───────────────────▼────────────────────┐
                 │  STOREFRONT (website customers see)    │
                 │  Next.js + Tailwind · EN/AR · RTL      │  hosted on Vercel
                 │  /kw/ar  /ae/en  /sa/ar …              │
                 └───────┬───────────────────┬────────────┘
                         │ API               │ content API
          ┌──────────────▼─────────┐   ┌─────▼──────────────────┐
          │ COMMERCE BACKEND       │   │ CMS (content)          │
          │ Medusa.js v2           │   │ Payload CMS            │
          │ products · prices      │   │ banners · craft stories│
          │ cart · orders · stock  │   │ blog · FAQ · policies  │
          │ customers · promos     │   └─────┬──────────────────┘
          │ + ADMIN DASHBOARD      │◄── family manages products/orders
          └──┬──────┬──────┬───────┘         │
             │      │      │                 │
     ┌───────▼┐ ┌───▼───┐ ┌▼──────────┐ ┌────▼──────┐
     │Postgres│ │ Redis │ │Meilisearch│ │ Cloudinary│  images
     │database│ │ cache │ │  search   │ │  / R2     │
     └────────┘ └───────┘ └───────────┘ └───────────┘
             │
   ┌─────────┼──────────────┬───────────────┬──────────────┐
   ▼         ▼              ▼               ▼              ▼
 Tap /     DHL / Aramex   Resend         WhatsApp API   Unifonic /
 MyFatoorah (shipping,    (email)        (order updates) Twilio (SMS/OTP)
 (payments) tracking)
```

## 2. Technology per layer

| Layer | Technology | What it does | Why this one |
|---|---|---|---|
| Frontend framework | **Next.js 15 (App Router) + React + TypeScript** | The website pages | Fast, SEO-friendly, mixes static product pages with dynamic cart/checkout |
| Styling | **Tailwind CSS** (logical properties) + **shadcn/ui** | Design and components | RTL support with `ms-/me-`, quick to build |
| Languages | **next-intl** | English / Arabic (later Hindi/Urdu) | Routing per language, RTL switch |
| Commerce engine | **Medusa.js v2** (Node.js) | Products, variants, prices, cart, checkout, orders, stock, promos, customers, **built-in admin** | Free/open source, **multi-region** (one region per GCC country), multi-currency, can become multi-vendor |
| Database | **PostgreSQL** | Stores all data | Required by Medusa, reliable |
| Cache / jobs | **Redis** | Sessions, background jobs, events | Required by Medusa in production |
| CMS | **Payload CMS** | Banners, craft stories, blog, pages | Bilingual fields; family edits content without code; uses the same Postgres |
| Search | **Meilisearch** | Product search with typo tolerance | Handles Arabic well, fast |
| Images | **Cloudinary** (or Cloudflare R2 + Images) | Store, resize and compress photos | Fast product images on mobile |
| Payments | **Tap Payments** or **MyFatoorah** | KNET, mada, BenefitPay, Apple Pay, Visa/MC | Covers all GCC local methods |
| BNPL (later) | **Tabby / Tamara** | Pay in 4 | Popular in KSA/UAE |
| Shipping | **DHL Express / Aramex / Shiprocket X** APIs | Rates, labels, tracking India→GCC | |
| Email | **Resend** (or Amazon SES) + React Email | Order emails | Easy, cheap |
| WhatsApp | **WhatsApp Cloud API** via Interakt / WATI | Order + shipping updates | GCC & India customers prefer WhatsApp |
| SMS / OTP | **Unifonic** (GCC) or Twilio | Login OTP, delivery alerts | Unifonic has good GCC delivery |
| Analytics | GA4 · Meta Pixel · **Snap Pixel** · TikTok Pixel · Microsoft Clarity | Traffic, ads, heatmaps | Snapchat is big in KW/KSA |
| Errors | **Sentry** | Alerts when something breaks | |
| Code | **GitHub** | Code storage + auto-deploy | |
| Design | **Figma** | Mockups before coding | |

## 3. Services to sign up for (checklist)

| # | Service | Purpose | When | Approx. cost |
|---|---|---|---|---|
| 1 | Namecheap / GoDaddy | Domain `insihouse.com` | Now | ~$10–20 / yr |
| 2 | Cloudflare | DNS, SSL, CDN, protection | Now | Free |
| 3 | Google Workspace or Zoho Mail | `info@insihouse.com` | Now | ~$1–6 / user / mo |
| 4 | GitHub | Code | Build start | Free |
| 5 | Vercel | Host storefront | Build start | Free → $20 / mo (Pro) |
| 6 | Railway / Render / DigitalOcean | Host Medusa + Payload + Postgres + Redis | Build start | ~$25–60 / mo |
| 7 | Cloudinary | Images | Build start | Free tier → ~$89 / mo later |
| 8 | Meilisearch Cloud (or self-host) | Search | Build | Free self-host / ~$30 / mo cloud |
| 9 | **Tap Payments or MyFatoorah** | Payments | Apply early (KYC takes weeks) | ~2.5–3% per sale, no monthly fee usually |
| 10 | DHL / Aramex / Shiprocket X | Shipping | Before launch | Per parcel |
| 11 | Resend | Email | Build | Free → $20 / mo |
| 12 | Interakt / WATI | WhatsApp API | Before launch | ~$15–50 / mo + per message |
| 13 | Unifonic / Twilio | SMS OTP | Optional | Per SMS |
| 14 | Sentry | Error tracking | Build | Free tier |
| 15 | Google Analytics, Meta, Snap, TikTok business accounts | Tracking + ads | Before launch | Free (ads extra) |
| 16 | Figma | Design | Design phase | Free → $15 / mo |

**Estimated running cost at launch:** ~**$80–200 / month** + payment fees + shipping (not counting developer time and ads).

## 4. Code / folder structure (monorepo)

```
insihouse/
├── apps/
│   ├── storefront/              Next.js website
│   │   ├── app/[country]/[lang]/
│   │   │   ├── page.tsx                     Home
│   │   │   ├── occasion/[slug]/page.tsx     Shop by occasion
│   │   │   ├── category/[slug]/page.tsx     Shop by category
│   │   │   ├── product/[slug]/page.tsx      Product detail
│   │   │   ├── maker/[slug]/page.tsx        Maker / artisan
│   │   │   ├── story/[slug]/page.tsx        Craft story
│   │   │   ├── cart/  checkout/  account/  track-order/
│   │   │   ├── corporate/  about/  contact/  faq/
│   │   │   └── policies/[slug]/
│   │   ├── components/          Header, ProductCard, CountrySwitcher, GiftMessage…
│   │   ├── lib/                 medusa client, cms client, money formatting (3-decimal KWD!)
│   │   └── messages/            en.json · ar.json
│   ├── backend/                 Medusa v2
│   │   ├── src/modules/         craft, maker, occasion, gift-message, reminder
│   │   ├── src/workflows/       place-order, send-whatsapp, create-shipment
│   │   ├── src/subscribers/     order.placed → email + WhatsApp
│   │   ├── src/api/             custom endpoints
│   │   └── medusa-config.ts     regions (KW, SA, AE, QA, BH, OM), payment + shipping plugins
│   └── cms/                     Payload CMS (banners, stories, blog, pages)
├── packages/
│   ├── ui/                      Shared RTL-safe components
│   └── config/                  ESLint, TS, Tailwind presets (brand colours)
├── docs/                        This knowledge base
├── .env.example                 List of required keys (never commit real .env)
└── README.md
```

## 5. Regions setup (Medusa)
| Region | Currency | Decimals | Tax | Payment methods |
|---|---|---|---|---|
| Kuwait | KWD | 3 | 0% (verify) | KNET, Apple Pay, cards |
| Saudi Arabia | SAR | 2 | 15% | mada, Apple Pay, cards, (Tabby/Tamara) |
| UAE | AED | 2 | 5% | Apple Pay, cards, (Tabby/Tamara) |
| Qatar | QAR | 2 | 0% (verify) | NAPS/cards, Apple Pay |
| Bahrain | BHD | 3 | 10% | BenefitPay, cards, Apple Pay |
| Oman | OMR | 3 | 5% | cards, Apple Pay |

Prices: set **manually per currency** for key products (clean prices like 12.500 KWD), with auto-conversion as a fallback.

## 6. Environments
| Environment | URL | Use |
|---|---|---|
| Local | localhost | Developer machine |
| Staging | staging.insihouse.com | Test with sandbox payments |
| Production | insihouse.com | Live |

## 7. Engineering rules
- CSS logical properties only (`ms-*`, `me-*`, `start/end`); never hard-code `left` / `right`.
- Money as integers in minor units; decimals from currency config (3 for KWD / BHD / OMR).
- Never hard-code a country. Everything comes from Region config.
- Every UI string goes through i18n.
- Secrets in `.env` only; `.env.example` lists the keys.

## 8. Alternative: Shopify version (if D-002 = Shopify)
| Need | Shopify solution |
|---|---|
| Store + admin + hosting | Shopify plan (~$39–105 / mo) |
| Multi-country, currency | Shopify **Markets** |
| Arabic + RTL | Arabic-ready theme + Shopify Translate & Adapt |
| Payments | Tap / MyFatoorah Shopify apps (KNET, mada, Apple Pay) |
| Gift message, delivery date | Apps (~$5–20 / mo each) |
| WhatsApp | Interakt / WATI Shopify app |
| Reviews | Judge.me |
| Shipping | Shiprocket X / Aramex app |

Faster launch (~3–6 weeks) and easier for the family, but recurring app fees, less design freedom, and harder to turn into a multi-artisan marketplace.
